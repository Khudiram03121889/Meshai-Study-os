import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MESH_API_KEY = Deno.env.get("MESH_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function embedOne(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const url = "https://api.meshapi.ai/v1/embeddings";
    const model = "openai/text-embedding-3-small";

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, studyContext } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let apiKey = MESH_API_KEY;
    if (!apiKey) {
      const { data: dbKey } = await admin.rpc("get_mesh_key");
      if (dbKey) apiKey = dbKey;
    }
    if (!apiKey) throw new Error("MESH_API_KEY is not configured");

    // ===== Build study-progress context =====
    let contextSection = "";
    if (studyContext) {
      const { startedChapters, completedChapters, recentLogs } = studyContext;
      if (startedChapters?.length > 0) {
        contextSection += `\n\nACTIVE CHAPTERS (prioritize):\n${startedChapters.map((c: any) => `- ${c.name} (${c.subject}) — ${c.progress}% done, Lecturer: ${c.lecturer}`).join("\n")}`;
      }
      if (completedChapters?.length > 0) {
        contextSection += `\n\nCOMPLETED CHAPTERS:\n${completedChapters.map((c: any) => `- ${c.name} (${c.subject})`).join("\n")}`;
      }
      if (recentLogs?.length > 0) {
        contextSection += `\n\nRECENT STUDY LOGS:\n${recentLogs.map((l: any) => `- ${l.date}: ${l.chapter} (${l.topics} topics, understanding: ${l.understanding}/5)`).join("\n")}`;
      }
    }

    // ===== Global RAG over all uploaded notes + learning memory =====
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    let memoryBlock = "";
    try {
      const qEmb = await embedOne(String(lastUserMsg).slice(0, 2000), apiKey);
      if (qEmb) {
        const { data: chunks } = await admin.rpc("match_note_chunks", {
          query_embedding: qEmb as any,
          match_user_id: user.id,
          match_count: 8,
          filter_subject: null,
          filter_note_id: null,
        });
        if (chunks?.length) {
          memoryBlock += `\n\n=== RELEVANT NOTE EXCERPTS (from your uploaded lectures) ===\n` +
            chunks.map((row: any) => `(p.${row.page_number || "?"}${row.topic ? ", " + row.topic : ""}) ${row.chunk_text}`).join("\n---\n");
        }
      }

      const { data: recentNotes } = await admin
        .from("notes")
        .select("file_name, ai_summary, detected_topics, created_at, class_sessions(session_date, subject_id, lecturers(name))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (recentNotes?.length) {
        memoryBlock += `\n\n=== RECENT UPLOADED LECTURES ===\n` +
          recentNotes.map((n: any) => {
            const s = n.class_sessions;
            return `- ${s?.session_date || "?"} | ${s?.subject_id || "?"} | ${s?.lecturers?.name || "?"} | ${n.file_name}${n.ai_summary ? `\n   Summary: ${n.ai_summary.slice(0, 240)}` : ""}`;
          }).join("\n");
      }

      const { data: mem } = await admin
        .from("memories")
        .select("content, memory_type, confidence_score, subject_slug")
        .eq("user_id", user.id)
        .neq("memory_type", "revision")
        .order("created_at", { ascending: false })
        .limit(10);
      if (mem?.length) {
        memoryBlock += `\n\n=== LEARNING MEMORY (weak areas / repeated mistakes / strengths) ===\n` +
          mem.map((m: any) => `- [${m.memory_type}] ${m.content}${m.subject_slug ? ` (${m.subject_slug})` : ""} — confidence ${Math.round((m.confidence_score || 0) * 100)}%`).join("\n");
      }
    } catch (e) {
      console.error("global RAG failed", e);
    }

    const SYSTEM_PROMPT = `You are Sameer's Study OS AI Tutor — Sameer's personal memory-aware academic coach for Karnataka 2nd PUC (Class 12).

You have long-term memory of every lecture Sameer has uploaded, his weak areas, and his study progress. Reference them naturally ("In your Pavan sir lecture from Oct 12 you covered…", "You marked X as a weak area, so let's revisit…").

ROLE:
- Help Sameer master Physics, Chemistry, and Mathematics for Boards (priority), KCET (secondary), JEE (optional).
- Explain concepts, solve problems step-by-step, quiz when asked.
- Markdown formatting: **bold** for key terms, bullet points.
- For ALL math use KaTeX: $...$ inline, $$...$$ display. Use \\frac, \\vec, \\hat, \\sqrt, \\int, \\sum. Do NOT use \\text{} for units — plain text after the formula.

SUBJECTS & LECTURERS:
- Physics: Pavan sir, Manasa Maam
- Chemistry: Jaffar Sir
- Mathematics: Upendra Sir

CONTEXT-AWARE BEHAVIOR:
- Prioritize active/completed chapters.
- When a relevant note excerpt is in context, USE it and cite it ("From your uploaded note on …").
- If memory shows a weak area on a topic the question touches, gently flag it.
${contextSection}${memoryBlock}

PROBLEM-SOLVING FORMAT (CRITICAL — follow this EXACTLY):

---
**Given:**
- one bullet per known

**To Find:**
- what we need
---
**Step 1: [short label]**

Explanation line.

$formula$

$substitution$

$result$

---
**Step 2: …**
…
---
**Answer:** …
---

MANDATORY:
1. NEVER combine multiple calculations in one line. One operation per line.
2. Put --- between EVERY step.
3. Blank line between every sub-step.
4. When expanding, show LHS and RHS on separate labeled lines.
5. Keep it concise. Be encouraging.`;


    const chatUrl = "https://api.meshapi.ai/v1/chat/completions";
    const chatModel = "openai/gpt-4o";

    const response = await fetch(chatUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-tutor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
