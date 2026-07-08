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

async function embedOne(text: string, apiKey: string): Promise<number[]> {
  const url = "https://api.meshapi.ai/v1/embeddings";
  const model = "openai/text-embedding-3-small";

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(`Embeddings failed: ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding;
}

const SYSTEM_PROMPT_BASE = `You are Sameer's Study OS AI Tutor — a memory-aware academic companion for Karnataka 2nd PUC (Class 12).

You are answering inside the context of a SPECIFIC lecture note the student uploaded. You also have access to RELATED notes from earlier lectures, weak-area memory, and past conversation context. Use them naturally — refer to them when relevant ("In your previous lecture on X…", "You marked Y as a weak area…").

FORMAT RULES:
- Markdown. Use **bold** for key terms.
- For all math, use KaTeX: $...$ inline, $$...$$ display. Use \\frac, \\vec, \\hat, \\sqrt, \\int, \\sum, etc.
- For step-by-step solutions, follow this format:

---
**Given:** … (one bullet per known)
**To Find:** …
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

RULES:
- Never combine multiple calculations on one line.
- Put --- between every step.
- Each sub-step on its own line with blank line above.
- Cite the note context when answering ("This is covered on page X of your note", "Your previous Pavan sir lecture established…").
- Be concise but clear. Encourage the student.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const {
      messages,
      noteId,
      scope,
      docContent,
      docMode,
      topicName,
      chapterName,
      subjectName,
      paperId,
      board,
      classLabel
    } = await req.json();
    if (!messages?.length) return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let apiKey = MESH_API_KEY;
    if (!apiKey) {
      const { data: dbKey } = await admin.rpc("get_mesh_key");
      if (dbKey) apiKey = dbKey;
    }
    if (!apiKey) throw new Error("MESH_API_KEY is not configured");

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    // RAG / Context retrieval
    let contextBlock = "";
    let systemPrompt = "";

    if (scope === "study_doc") {
      contextBlock = `\n\n=== STUDY DOCUMENT CONTEXT ===\nMode: ${docMode}\nTopic: ${topicName}\nChapter: ${chapterName || "-"}\nSubject: ${subjectName || "-"}\n\n=== DOCUMENT CONTENT ===\n${docContent}\n=== END ===\n`;

      systemPrompt = `You are Study OS AI Tutor. You are answering inside the context of a SPECIFIC generated study document (${docMode === "prelearn" ? "Pre-Learn" : "Learn"} Mode). Use the document as your primary source. If a question is outside the document, answer briefly and then bring it back to the document.

FORMAT:
- Markdown. Use **bold** for key terms.
- For math, use KaTeX: $...$ inline, $$...$$ display.
- For solutions, separate steps with --- and put each formula on its own line.
- Be concise, clear, and encouraging.` + contextBlock;

    } else if (scope === "test_paper") {
      const targetPaperId = paperId || noteId;
      try {
        const { data: paper } = await admin
          .from("test_papers")
          .select("*")
          .eq("id", targetPaperId)
          .single();
        const { data: qs } = await admin
          .from("test_questions")
          .select("*")
          .eq("test_paper_id", targetPaperId)
          .order("created_at", { ascending: true });

        contextBlock = `\n\n=== TEST PAPER CONTEXT ===\n`;
        contextBlock += `Title: ${paper?.title || "Unknown"}\n`;
        contextBlock += `Subject: ${paper?.subject_id || "Unknown"}\n`;
        if (paper?.ai_analysis) contextBlock += `Analysis: ${paper.ai_analysis}\n`;
        
        if (qs?.length) {
          contextBlock += `\n=== EXTRACTED QUESTIONS ===\n`;
          qs.forEach((q, i) => {
            contextBlock += `Q${i+1} [${q.marks || '?'} marks, Topic: ${q.topic || 'Unknown'}]: ${q.question_text}\n`;
          });
        }
      } catch (e) {
        console.error("Test paper fetch failed", e);
      }

      const userBoard = board || "CBSE";
      const userClass = classLabel || "12";
      const SYSTEM_PROMPT_BASE = `You are Study OS AI Tutor — a memory-aware academic companion for ${userBoard} Class ${userClass}.

You are answering inside the context of a SPECIFIC TEST PAPER the student uploaded. You have access to the questions extracted from this paper. Help the student solve these questions or explain the concepts behind them.

FORMAT RULES:
- Markdown. Use **bold** for key terms.
- For all math, use KaTeX: $...$ inline, $$...$$ display. Use \\frac, \\vec, \\hat, \\sqrt, \\int, \\sum, etc.
- For step-by-step solutions, follow this format:

---
**Given:** … (one bullet per known)
**To Find:** …
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

RULES:
- Never combine multiple calculations on one line.
- Put --- between every step.
- Each sub-step on its own line with blank line above.
- Be concise but clear. Encourage the student.`;

      systemPrompt = SYSTEM_PROMPT_BASE + contextBlock;

    } else {
      try {
        const qEmb = await embedOne(lastUserMsg.slice(0, 2000), apiKey);
        const isGlobal = scope === "global" || !noteId;

        // primary: current note chunks (if noteId)
        const calls: any[] = [];
        if (!isGlobal && noteId) {
          calls.push(admin.rpc("match_note_chunks", {
            query_embedding: qEmb as any, match_user_id: user.id, match_count: 6, filter_subject: null, filter_note_id: noteId,
          }));
        }
        // secondary: related across all notes
        calls.push(admin.rpc("match_note_chunks", {
          query_embedding: qEmb as any, match_user_id: user.id, match_count: isGlobal ? 10 : 4, filter_subject: null, filter_note_id: null,
        }));
        const results = await Promise.all(calls);
        const pieces: string[] = [];
        results.forEach((r) => {
          if (r.data) {
            r.data.forEach((row: any) => {
              pieces.push(`(p.${row.page_number || "?"}${row.topic ? ", " + row.topic : ""}) ${row.chunk_text}`);
            });
          }
        });

        // current note metadata
        if (noteId) {
          const { data: note } = await admin.from("notes")
            .select("file_name, ai_summary, detected_topics, class_sessions(session_date, subject_id, title, summary, continuity_context, lecturers(name))")
            .eq("id", noteId).eq("user_id", user.id).single();
          if (note) {
            const s: any = (note as any).class_sessions;
            contextBlock += `\n\n=== CURRENT NOTE ===\nFile: ${note.file_name}\nSubject: ${s?.subject_id || "?"}\nDate: ${s?.session_date || "?"}\nLecturer: ${s?.lecturers?.name || "?"}\nSummary: ${note.ai_summary || ""}\nTopics: ${(note.detected_topics || []).join(", ")}\n${s?.continuity_context ? `Continuity: ${s.continuity_context}` : ""}`;
          }
        }

        if (pieces.length) {
          contextBlock += `\n\n=== RELEVANT NOTE EXCERPTS ===\n${pieces.slice(0, 12).join("\n---\n")}`;
        }

        // learning memory
        const { data: mem } = await admin.from("memories")
          .select("content, memory_type, confidence_score")
          .eq("user_id", user.id)
          .neq("memory_type", "revision")
          .order("created_at", { ascending: false })
          .limit(10);
        if (mem?.length) {
          contextBlock += `\n\n=== LEARNING MEMORY ===\n${mem.map((m: any) => `- [${m.memory_type}] ${m.content} (confidence ${Math.round((m.confidence_score || 0) * 100)}%)`).join("\n")}`;
        }
      } catch (e) {
        console.error("RAG retrieval failed", e);
      }

      systemPrompt = SYSTEM_PROMPT_BASE + (contextBlock ? `\n\nCONTEXT:${contextBlock}` : "");
    }

    const chatUrl = "https://api.meshapi.ai/v1/chat/completions";
    const chatModel = "openai/gpt-4o";

    const response = await fetch(chatUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e: any) {
    console.error("pdf-tutor error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
