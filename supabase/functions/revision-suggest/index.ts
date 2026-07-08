import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MESH_API_KEY = Deno.env.get("MESH_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function parseJsonResponse(content: string): any {
  let clean = content.trim();
  if (clean.startsWith("```")) {
    const lines = clean.split("\n");
    const firstLine = lines[0];
    const lastLine = lines[lines.length - 1];
    if (firstLine.startsWith("```") && lastLine.startsWith("```")) {
      clean = lines.slice(1, -1).join("\n").trim();
    } else {
      const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) clean = match[1].trim();
    }
  }
  return JSON.parse(clean);
}

async function aiJson(prompt: string): Promise<any> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let apiKey = MESH_API_KEY;
  if (!apiKey) {
    const { data: dbKey } = await admin.rpc("get_mesh_key");
    if (dbKey) apiKey = dbKey;
  }
  if (!apiKey) throw new Error("API key not configured");
  const url = "https://api.meshapi.ai/v1/chat/completions";
  const model = "openai/gpt-4o";

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  try {
    return parseJsonResponse(j.choices[0]?.message?.content || "{}");
  } catch (err) {
    console.error("Failed to parse JSON response:", err, j.choices[0]?.message?.content);
    return {};
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { action = "queue", topic, subject } = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ===== Action: queue → returns prioritized list =====
    if (action === "queue") {
      const { data: mems } = await admin.from("memories")
        .select("id, memory_type, content, confidence_score, subject_slug, metadata, updated_at, created_at")
        .eq("user_id", user.id);

      const getTopic = (m: any) => {
        if (m.metadata?.topic) return m.metadata.topic;
        if (m.content.startsWith("Revision needed for: ")) {
          return m.content.split(". Confidence:")[0].replace("Revision needed for: ", "").trim();
        }
        if (m.content.startsWith("Topic: ")) {
          return m.content.split("\n")[0].replace("Topic: ", "").trim();
        }
        return m.content;
      };

      const revs = (mems || []).filter((m: any) => m.memory_type === "revision");
      const mistakes = (mems || []).filter((m: any) => ["mistake", "weak_area", "confusion", "exam_repeated"].includes(m.memory_type));

      const revByTopic = new Map(revs.map((r: any) => [getTopic(r).toLowerCase(), r]));

      const now = Date.now();
      const queueItems = [...revs];
      for (const m of mistakes) {
        const topic = getTopic(m);
        if (!revByTopic.has(topic.toLowerCase())) {
          queueItems.push(m);
        }
      }

      const queue = queueItems.map((m: any) => {
        const topic = getTopic(m);
        const isRevision = m.memory_type === "revision";
        const lastRev = isRevision
          ? (m.metadata?.last_revised ? new Date(m.metadata.last_revised).getTime() : new Date(m.updated_at || m.created_at).getTime())
          : new Date(m.updated_at || m.created_at).getTime();
        const daysSince = Math.max(1, Math.round((now - lastRev) / 86400000));
        const conf = m.confidence_score ?? 0.5;
        const revCount = isRevision ? (m.metadata?.revision_count || 0) : 0;
        const priority = (1 - conf) * 60 + Math.min(daysSince, 30) * 2 + (m.memory_type === "mistake" ? 25 : 0);
        return {
          topic,
          subject_id: m.subject_slug,
          memory_type: m.memory_type,
          confidence: Math.round(conf * 100),
          days_since_revision: daysSince,
          revision_count: revCount,
          priority: Math.round(priority),
          note: m.content,
        };
      }).sort((a, b) => b.priority - a.priority).slice(0, 20);

      return new Response(JSON.stringify({ queue }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Action: generate flashcards / viva / formulas / summary for a topic =====
    if (["flashcards", "viva", "formulas", "summary"].includes(action)) {
      if (!topic) return new Response(JSON.stringify({ error: "topic required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // check cache
      const { data: cached } = await admin.from("ai_generated_content")
        .select("*")
        .eq("user_id", user.id)
        .eq("content_type", action)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cached?.length) {
        const c = cached[0];
        if ((c.generated_content as any)?.topic?.toLowerCase() === topic.toLowerCase()) {
          return new Response(JSON.stringify({ cached: true, content: c.generated_content }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const subj = subject ? ` (${subject})` : "";
      let prompt = "";
      const mathInstruction = "IMPORTANT: For all math/formulas, use KaTeX-compatible notation: inline math with single dollar signs $...$, display math with double dollar signs $$...$$. Never use \\[ \\] or \\( \\) delimiters.";

      if (action === "flashcards") {
        prompt = `Generate 8 concise Q/A flashcards for the topic "${topic}"${subj} for Karnataka 2nd PUC.
${mathInstruction}
Return STRICT JSON:
{ "topic": "${topic}", "cards": [{ "q": "question (use KaTeX math if needed)", "a": "concise answer (use KaTeX math if needed)" }] }`;
      } else if (action === "viva") {
        prompt = `Generate 6 viva-style oral questions with model answers on "${topic}"${subj} for Karnataka 2nd PUC.
${mathInstruction}
Return STRICT JSON:
{ "topic": "${topic}", "questions": [{ "q": "viva question (use KaTeX math if needed)", "a": "model answer 1-3 sentences (use KaTeX math if needed)" }] }`;
      } else if (action === "summary") {
        prompt = `Generate a concise 1-minute audio explanation script summarizing the key definitions, principles, and high-frequency board questions for the topic "${topic}"${subj} for Karnataka 2nd PUC. Keep the narration natural, conversational, and direct. Keep it under 150 words.
IMPORTANT: Never use LaTeX math formulas or delimiters. Use plain spoken English words instead (e.g. write "squared" instead of ^2, "plus" instead of +, "integration from a to b" instead of \\int_a^b) so that a text-to-speech engine can read it aloud smoothly and naturally.
Return STRICT JSON:
{ "topic": "${topic}", "script": "narration script text here..." }`;
      } else {
        prompt = `List the key formulas/equations a 2nd PUC student must know for "${topic}"${subj}.
${mathInstruction}
Return STRICT JSON:
{ "topic": "${topic}", "formulas": [{ "name": "formula name", "formula": "$...$", "when": "when to apply" }] }`;
      }
      const json = await aiJson(prompt);

      await admin.from("ai_generated_content").insert({
        user_id: user.id, content_type: action, generated_content: json,
      });

      return new Response(JSON.stringify({ cached: false, content: json }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Action: mark_revised → bumps revision confidence =====
    if (action === "mark_revised") {
      if (!topic) return new Response(JSON.stringify({ error: "topic required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      
      const { data: revs } = await admin.from("memories")
        .select("*")
        .eq("user_id", user.id)
        .eq("memory_type", "revision");

      const getTopic = (m: any) => {
        if (m.metadata?.topic) return m.metadata.topic;
        if (m.content.startsWith("Revision needed for: ")) {
          return m.content.split(". Confidence:")[0].replace("Revision needed for: ", "").trim();
        }
        return m.content;
      };

      const existing = (revs || []).find((m: any) => getTopic(m).toLowerCase() === topic.toLowerCase());

      if (existing) {
        const newConf = Math.min(1.0, (existing.confidence_score || 0.5) + 0.1);
        const prevCount = existing.metadata?.revision_count || 0;
        await admin.from("memories").update({
          confidence_score: newConf,
          content: `Revision needed for: ${topic}. Confidence: ${newConf}`,
          updated_at: new Date().toISOString(),
          metadata: {
            ...existing.metadata,
            last_revised: new Date().toISOString(),
            revision_count: prevCount + 1,
          }
        }).eq("id", existing.id);
      } else {
        const { data: baseMems } = await admin.from("memories")
          .select("*")
          .eq("user_id", user.id)
          .neq("memory_type", "revision");
        const baseMem = (baseMems || []).find((m: any) => getTopic(m).toLowerCase() === topic.toLowerCase());
        const baseConf = baseMem?.confidence_score ?? 0.5;

        await admin.from("memories").insert({
          user_id: user.id,
          memory_type: "revision",
          content: `Revision needed for: ${topic}. Confidence: ${Math.min(1.0, baseConf + 0.1)}`,
          confidence_score: Math.min(1.0, baseConf + 0.1),
          subject_slug: subject || null,
          source: "manual",
          metadata: {
            last_revised: new Date().toISOString(),
            revision_count: 1,
          }
        });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("revision-suggest error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, { port: parseInt(Deno.env.get("PORT") || "8000") });
