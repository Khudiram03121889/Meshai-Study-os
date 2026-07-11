/**
 * MeshStudy AI — Memory Backfill
 *
 * Walks the user's entire chat_messages history conversation-by-conversation,
 * runs the same reflection extraction used after each new chat, and
 * dedupes/supersedes into the memories table. Safe to re-run.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REFLECTION_PROMPT = `You are the MeshStudy AI Reflection Engine.
Analyze the chat between a student and their AI tutor and extract LONG-TERM MEMORIES.

Memory Types:
1. "mistake": student showed a fundamental misunderstanding.
2. "insight": student finally grasped a concept.
3. "preference": student stated how they like to learn.
4. "working": temporary goal/context. Set expires_in_hours.

Respond ONLY with JSON:
{"memories":[{"type":"mistake|insight|preference|working","content":"...","subject_slug":"physics|chemistry|mathematics|null","confidence":0.0-1.0,"expires_in_hours":number|null}]}
Return {"memories":[]} if nothing worth remembering.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const meshApiKey = Deno.env.get("MESH_API_KEY");
    if (!meshApiKey) throw new Error("Missing Mesh API Key");

    // Fetch all conversations, oldest first (so newer chats supersede older preferences correctly)
    const { data: convs } = await admin
      .from("chat_conversations")
      .select("id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    let convsProcessed = 0;
    let memoriesWritten = 0;

    for (const conv of convs || []) {
      const { data: msgs } = await admin
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      if (!msgs || msgs.length < 2) continue;

      // Chunk into windows of ~10 turns to keep prompts small
      const CHUNK = 10;
      for (let i = 0; i < msgs.length; i += CHUNK) {
        const msgsChunk = msgs.slice(i, i + CHUNK);

        const res = await fetch("https://api.meshapi.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${meshApiKey}` },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            messages: [
              { role: "system", content: REFLECTION_PROMPT },
              { role: "user", content: `History:\n${JSON.stringify(msgsChunk)}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          })
        });
        if (!res.ok) { console.error("[backfill] mesh API failed", await res.text()); continue; }
        const data = await res.json();
        const { memories = [] } = JSON.parse(data.choices[0]?.message?.content || "{}");

        for (const mem of memories) {
          if (!mem.content) continue;
          const embedRes = await fetch("https://api.meshapi.ai/v1/embeddings", {
            method: "POST",
            headers: { "Authorization": `Bearer ${meshApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "openai/text-embedding-3-small", input: mem.content })
          });
          const embedding = (await embedRes.json()).data[0].embedding;

          const expires_at = mem.expires_in_hours
            ? new Date(Date.now() + mem.expires_in_hours * 3600 * 1000).toISOString()
            : null;

          const { data: similar } = await admin.rpc("match_memories", {
            query_embedding: embedding as any,
            match_user_id: user.id,
            match_count: 3,
            filter_memory_type: mem.type,
            filter_subject: mem.subject_slug || null,
          });
          const top = (similar || [])[0];
          const isPref = mem.type === "preference";
          const threshold = isPref ? 0.80 : 0.90;

          if (top && top.similarity >= threshold) {
            if (isPref) {
              await admin.from("memories").update({
                content: mem.content, embedding, confidence_score: mem.confidence || 0.9,
                source: "backfill", expires_at, updated_at: new Date().toISOString(),
              }).eq("id", top.id);
            } else {
              await admin.from("memories").update({
                frequency_count: (top.frequency_count || 1) + 1,
                confidence_score: Math.max(top.confidence_score || 0, mem.confidence || 0.8),
                content: mem.content, embedding, updated_at: new Date().toISOString(),
              }).eq("id", top.id);
            }
          } else {
            await admin.from("memories").insert({
              user_id: user.id,
              memory_type: mem.type,
              content: mem.content,
              embedding,
              subject_slug: mem.subject_slug || null,
              confidence_score: mem.confidence || 0.8,
              source: "backfill",
              expires_at,
            });
            memoriesWritten++;
          }
        }
      }
      convsProcessed++;
    }

    return new Response(JSON.stringify({ ok: true, convsProcessed, memoriesWritten }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[ai-memory-backfill] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
