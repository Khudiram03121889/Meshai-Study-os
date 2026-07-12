/**
 * MeshStudy AI — Reflection Layer (Handbook §08, §19 §10)
 *
 * Runs asynchronously after the chat completes. It reads the last few turns,
 * identifies core conceptual gaps, extracted insights, or user preferences,
 * and writes them to the `memories` table.
 *
 * It uses the V2 unified memories schema.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatTurn {
  role: string;
  content: string;
}

const REFLECTION_PROMPT = `You are the MeshStudy AI Reflection Engine.
Your job is to analyze the recent chat between the student and the AI tutor and extract any LONG-TERM MEMORIES.

Memory Types:
1. "mistake": The student showed a fundamental misunderstanding of a concept.
2. "insight": The student finally grasped a concept ("Oh, I get it now...").
3. "preference": The student stated how they like to learn ("I prefer visual examples", "I hate long texts").
4. "working": A temporary goal or context ("I have a test tomorrow"). Set expires_in_hours.

Respond ONLY with a JSON list:
{
  "memories": [
    {
      "type": "mistake|insight|preference|working",
      "content": "Short, precise description of the memory",
      "subject_slug": "physics|chemistry|mathematics or null",
      "confidence": 0.0 to 1.0,
      "expires_in_hours": number or null
    }
  ]
}
If there is nothing worth remembering, return {"memories": []}.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { history = [], subjectId } = await req.json();
    if (!history || history.length === 0) return new Response("No history");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const meshApiKey = Deno.env.get("MESH_API_KEY");
    if (!meshApiKey) throw new Error("Missing Mesh API API Key");

    // Only analyze last 6 turns to avoid context bloat
    const recentHistory = history.slice(-6);

    const payload = {
      model: "openai/gpt-4o-mini", // cheap enough for background tasks
      messages: [
        { role: "system", content: REFLECTION_PROMPT },
        { role: "user", content: `History:\n${JSON.stringify(recentHistory)}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    };

    const res = await fetch("https://api.meshapi.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${meshApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Mesh API error");
    
    const data = await res.json();
    const content = data.choices[0]?.message?.content;
    const { memories = [] } = JSON.parse(content || "{}");

    for (const mem of memories) {
      if (!mem.content) continue;

      // Generate embedding for semantic search
      const embedRes = await fetch("https://api.meshapi.ai/v1/embeddings", {
        method: "POST",
        headers: { "Authorization": `Bearer ${meshApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/text-embedding-3-small", input: mem.content })
      });
      const embedData = await embedRes.json();
      const embedding = embedData.data[0].embedding;

      let expires_at: string | null = null;
      if (mem.expires_in_hours) {
        expires_at = new Date(Date.now() + mem.expires_in_hours * 60 * 60 * 1000).toISOString();
      }

      // Deduplicate / resolve contradictions: find semantically-similar existing
      // memory of the SAME type; if very similar, update-in-place; if it's a
      // preference and moderately similar, treat as a change and supersede.
      const { data: similar } = await adminClient.rpc("match_memories", {
        query_embedding: embedding as any,
        match_user_id: user.id,
        match_count: 3,
        filter_memory_type: mem.type,
        filter_subject: mem.subject_slug || subjectId || null,
      });

      const top = (similar || [])[0];
      const isPreference = mem.type === "preference";
      const dupThreshold = isPreference ? 0.80 : 0.90; // preferences supersede more eagerly

      if (top && top.similarity >= dupThreshold) {
        if (isPreference) {
          // Supersede: replace the old preference wholesale
          await adminClient.from("memories").update({
            content: mem.content,
            embedding: embedding,
            confidence_score: mem.confidence || 0.9,
            source: "reflection",
            expires_at: expires_at,
            updated_at: new Date().toISOString(),
          }).eq("id", top.id);
        } else {
          // Reinforce: bump frequency & recency, keep highest confidence
          await adminClient.from("memories").update({
            frequency_count: (top.frequency_count || 1) + 1,
            confidence_score: Math.max(top.confidence_score || 0, mem.confidence || 0.8),
            content: mem.content, // refresh phrasing with latest evidence
            embedding: embedding,
            updated_at: new Date().toISOString(),
          }).eq("id", top.id);
        }
        continue;
      }

      await adminClient.from("memories").insert({
        user_id: user.id,
        memory_type: mem.type,
        content: mem.content,
        embedding: embedding,
        subject_slug: mem.subject_slug || subjectId || null,
        confidence_score: mem.confidence || 0.8,
        source: "reflection",
        expires_at: expires_at
      });
    }

    return new Response(JSON.stringify({ processed: memories.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[ai-reflection-worker] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}, { port: parseInt(Deno.env.get("PORT") || "8000") });
