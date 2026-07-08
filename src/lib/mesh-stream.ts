import { supabase } from "@/integrations/supabase/client";

export async function getMeshKey(): Promise<string | null> {
  return null;
}

const mapModel = (m: string) => {
  if (m.includes("/")) return m;
  if (m === "openai/gpt-4o-mini") return "openai/gpt-4o-mini";
  if (m === "openai/gpt-4o") return "openai/gpt-4o";
  if (m === "openai/o3-mini") return "openai/o3-mini";
  return `openai/${m}`;
};

export async function embedText(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.meshapi.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: text,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

export async function getTutorContext(userId: string, lastMessage: string, apiKey: string): Promise<string> {
  let memoryBlock = "";
  try {
    const qEmb = await embedText(lastMessage.slice(0, 2000), apiKey);
    if (qEmb) {
      const { data: chunks } = await supabase.rpc("match_note_chunks", {
        query_embedding: qEmb as any,
        match_user_id: userId,
        match_count: 8,
        filter_subject: null,
        filter_note_id: null,
      });
      if (chunks?.length) {
        memoryBlock += `\n\n=== RELEVANT NOTE EXCERPTS (from your uploaded lectures) ===\n` +
          chunks.map((row: any) => `(p.${row.page_number || "?"}${row.topic ? ", " + row.topic : ""}) ${row.chunk_text}`).join("\n---\n");
      }
    }

    const { data: recentNotes } = await supabase
      .from("notes")
      .select("file_name, ai_summary, detected_topics, created_at, class_sessions(session_date, subject_id, lecturers(name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (recentNotes?.length) {
      memoryBlock += `\n\n=== RECENT UPLOADED LECTURES ===\n` +
        recentNotes.map((n: any) => {
          const s = n.class_sessions;
          return `- ${s?.session_date || "?"} | ${s?.subject_id || "?"} | ${s?.lecturers?.name || "?"} | ${n.file_name}${n.ai_summary ? `\n   Summary: ${n.ai_summary.slice(0, 240)}` : ""}`;
        }).join("\n");
    }

    const { data: mem } = await supabase
      .from("memories")
      .select("content, memory_type, confidence_score, subject_slug")
      .eq("user_id", userId)
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
  return memoryBlock;
}

export async function getPDFTutorContext(
  userId: string,
  lastMessage: string,
  noteId: string,
  scope: string,
  apiKey: string
): Promise<string> {
  let contextBlock = "";
  try {
    const qEmb = await embedText(lastMessage.slice(0, 2000), apiKey);
    if (qEmb) {
      const isGlobal = scope === "global" || !noteId;
      const calls: Promise<any>[] = [];
      if (!isGlobal && noteId) {
        calls.push(Promise.resolve(supabase.rpc("match_note_chunks", {
          query_embedding: qEmb as any, match_user_id: userId, match_count: 6, filter_subject: null, filter_note_id: noteId,
        })));
      }
      calls.push(Promise.resolve(supabase.rpc("match_note_chunks", {
        query_embedding: qEmb as any, match_user_id: userId, match_count: isGlobal ? 10 : 4, filter_subject: null, filter_note_id: null,
      })));

      const results = await Promise.all(calls);
      const pieces: string[] = [];
      results.forEach((r) => {
        if (r.data) {
          r.data.forEach((row: any) => {
            pieces.push(`(p.${row.page_number || "?"}${row.topic ? ", " + row.topic : ""}) ${row.chunk_text}`);
          });
        }
      });

      if (noteId) {
        const { data: note } = await supabase.from("notes")
          .select("file_name, ai_summary, detected_topics, class_sessions(session_date, subject_id, title, summary, continuity_context, lecturers(name))")
          .eq("id", noteId).eq("user_id", userId).single();
        if (note) {
          const s: any = (note as any).class_sessions;
          contextBlock += `\n\n=== CURRENT NOTE ===\nFile: ${note.file_name}\nSubject: ${s?.subject_id || "?"}\nDate: ${s?.session_date || "?"}\nLecturer: ${s?.lecturers?.name || "?"}\nSummary: ${note.ai_summary || ""}\nTopics: ${((note.detected_topics as any) || []).join(", ")}\n${s?.continuity_context ? `Continuity: ${s.continuity_context}` : ""}`;
        }
      }

      if (pieces.length) {
        contextBlock += `\n\n=== RELEVANT NOTE EXCERPTS ===\n${pieces.slice(0, 12).join("\n---\n")}`;
      }

      const { data: mem } = await supabase.from("memories")
        .select("content, memory_type, confidence_score")
        .eq("user_id", userId)
        .neq("memory_type", "revision")
        .order("created_at", { ascending: false })
        .limit(10);
      if (mem?.length) {
        contextBlock += `\n\n=== LEARNING MEMORY ===\n${mem.map((m: any) => `- [${m.memory_type}] ${m.content} (confidence ${Math.round((m.confidence_score || 0) * 100)}%)`).join("\n")}`;
      }
    }
  } catch (e) {
    console.error("RAG retrieval failed", e);
  }
  return contextBlock;
}

export async function streamMeshChat({
  apiKey,
  systemPrompt,
  messages,
  onDelta,
  onDone,
}: {
  apiKey: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const selectedModel = "openai/gpt-4o";
  const systemRole = "system";

  const response = await fetch("https://api.meshapi.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: mapModel(selectedModel),
      messages: [
        { role: systemRole as any, content: systemPrompt },
        ...messages
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Mesh API error ${response.status}`);
  }

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }
  onDone();
}
