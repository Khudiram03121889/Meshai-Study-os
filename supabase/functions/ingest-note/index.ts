import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MESH_API_KEY = Deno.env.get("MESH_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function chunkText(text: string, target = 800, overlap = 120): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= target) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + target, clean.length);
    // try to break at a paragraph/sentence
    if (end < clean.length) {
      const para = clean.lastIndexOf("\n\n", end);
      const sent = clean.lastIndexOf(". ", end);
      const brk = Math.max(para, sent);
      if (brk > i + target / 2) end = brk + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = end - overlap;
  }
  return chunks.filter((c) => c.length > 30);
}

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

async function embed(texts: string[], apiKey: string): Promise<number[][]> {
  const url = "https://api.meshapi.ai/v1/embeddings";
  const model = "openai/text-embedding-3-small";

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) throw new Error(`Embeddings failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d: any) => d.embedding);
}

async function refineText(text: string, apiKey: string): Promise<string> {
  const prompt = `You are a professional text formatter. You are given a raw OCR-extracted transcription of lecture notes.
Your task is to refine it:
1. Fix any typos or OCR reading errors.
2. Format all mathematical equations into clean KaTeX/LaTeX formatting. Use inline math with single dollar signs $...$, display math with double dollar signs $$...$$.
3. Preserve the original structure (headings, bullet points, lists, sections) but make it clean, structured, and readable in Markdown.
4. Do NOT summarize or add commentary. Return ONLY the refined lecture notes content.

RAW OCR TEXT:
"""
${text.slice(0, 15000)}
"""`;

  const url = "https://api.meshapi.ai/v1/chat/completions";
  const model = "openai/gpt-4o";

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }]
    }),
  });
  if (!res.ok) {
    console.error("Refine text failed", res.status, await res.text());
    return text;
  }
  const j = await res.json();
  return (j.choices?.[0]?.message?.content || text).trim();
}

async function summarize(text: string, subject: string, apiKey: string): Promise<{ summary: string; topics: string[]; chapter_hint: string }> {
  const prompt = `You are analyzing class notes for subject: ${subject}.

Given the following raw note text, return STRICT JSON only (no markdown fences, no commentary):
{
  "summary": "2-4 sentence summary of what this lecture covered",
  "topics": ["topic1", "topic2", "topic3"],
  "chapter_hint": "best-guess chapter name"
}

NOTES:
"""
${text.slice(0, 8000)}
"""`;
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
  if (!res.ok) {
    console.error("summarize failed", res.status, await res.text());
    return { summary: "", topics: [], chapter_hint: "" };
  }
  const j = await res.json();
  try {
    const parsed = parseJsonResponse(j.choices[0]?.message?.content || "{}");
    return {
      summary: parsed.summary || "",
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      chapter_hint: parsed.chapter_hint || "",
    };
  } catch {
    return { summary: j.choices[0].message.content || "", topics: [], chapter_hint: "" };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let currentNoteId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { noteId } = await req.json();
    currentNoteId = noteId;
    if (!noteId) return new Response(JSON.stringify({ error: "noteId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let apiKey = MESH_API_KEY;
    if (!apiKey) {
      const { data: dbKey } = await admin.rpc("get_mesh_key");
      if (dbKey) apiKey = dbKey;
    }
    if (!apiKey) throw new Error("MESH_API_KEY is not configured");

    const { data: note, error: noteErr } = await admin.from("notes").select("*, class_sessions(*)").eq("id", noteId).eq("user_id", user.id).single();
    if (noteErr || !note) {
      return new Response(JSON.stringify({ error: "Note not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const mimeType = note.mime_type || "application/pdf";

    await admin.from("notes").update({ status: "processing", error_message: null }).eq("id", noteId);

    // download from storage
    const { data: file, error: dlErr } = await admin.storage.from("notes-pdfs").download(note.storage_path);
    if (dlErr || !file) throw new Error(`Download failed: ${dlErr?.message}`);
    const buf = new Uint8Array(await file.arrayBuffer());

    // extract text per page
    let fullText = "";
    const pageTexts: string[] = [];
    try {
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(text) ? text : [text];
      pages.forEach((p: string) => pageTexts.push(p || ""));
      fullText = pages.join("\n\n");
    } catch (e) {
      console.error("PDF parse failed natively, will try OCR fallback", e);
    }

    if (!fullText.trim() || fullText.trim().length < 50) {
      console.log(`Native text too short (${fullText.length} chars). Attempting OCR via Mesh API (gpt-4o)...`);

      const base64 = encodeBase64(buf);
      console.log(`PDF base64 length: ${base64.length} (~${Math.round(base64.length / 1024)} KB)`);

      const callOcr = async (model: string) => {
        if (!apiKey) throw new Error("API key not configured");
        const url = "https://api.meshapi.ai/v1/chat/completions";
        const ocrModel = model;

        const isPdf = mimeType.includes("pdf");
        const ocrPrompt = isPdf
          ? "Perform OCR on this PDF (may be scanned handwritten or printed notes). Extract ALL text exactly as written, preserving order, headings, bullets and equations. Output ONLY the extracted text — no commentary, no markdown fences."
          : "Perform OCR on this image (may be whiteboard notes, blackboard notes, or handwritten notes). Extract ALL text exactly as written, preserving order, headings, bullets and equations. Output ONLY the extracted text — no commentary, no markdown fences.";
        const dataUri = `data:${mimeType};base64,${base64}`;

        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${ocrApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ocrModel,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: ocrPrompt },
                { type: "image_url", image_url: { url: dataUri } },
              ],
            }],
          }),
        });
        const bodyText = await res.text();
        if (!res.ok) {
          console.error(`OCR ${model} HTTP ${res.status}:`, bodyText.slice(0, 500));
          throw new Error(`OCR (${model}) failed: ${res.status} ${bodyText.slice(0, 300)}`);
        }
        try {
          const j = JSON.parse(bodyText);
          return (j.choices?.[0]?.message?.content || "").trim();
        } catch {
          console.error("OCR response not JSON:", bodyText.slice(0, 300));
          return "";
        }
      };

      let extractedContent = "";
      try {
        console.log("Calling gpt-4o-mini for cheap initial OCR...");
        extractedContent = await callOcr("openai/gpt-4o-mini");
      } catch (e: any) {
        console.warn("Mini OCR failed, retrying with gpt-4o:", e?.message);
        try {
          extractedContent = await callOcr("openai/gpt-4o");
        } catch (e2: any) {
          throw new Error("This PDF appears to be a scanned document or has no selectable text. Digital PDFs are required for text extraction. Please use a digital PDF or OCR the file before uploading.");
        }
      }

      console.log(`OCR extracted ${extractedContent.length} chars. Refining with gpt-4o...`);

      if (!extractedContent || extractedContent.length < 50) {
        throw new Error("Could not extract readable text from this PDF. The scan may be very low quality, password-protected, or contain only images without recognizable text. Try a clearer scan or a PDF with selectable text.");
      }

      try {
        extractedContent = await refineText(extractedContent, apiKey);
        console.log(`Refined text length: ${extractedContent.length} chars`);
      } catch (refErr) {
        console.warn("Refinement failed, using raw OCR text:", refErr);
      }

      fullText = extractedContent;
      pageTexts.length = 0;
      pageTexts.push(fullText);
    }


    // chunk per page, keep page numbers
    type Chunk = { text: string; page: number };
    const chunks: Chunk[] = [];
    pageTexts.forEach((pt, idx) => {
      chunkText(pt).forEach((c) => chunks.push({ text: c, page: idx + 1 }));
    });

    // embed in batches of 32
    const allEmb: number[][] = [];
    for (let i = 0; i < chunks.length; i += 32) {
      const batch = chunks.slice(i, i + 32).map((c) => c.text);
      const emb = await embed(batch, apiKey);
      allEmb.push(...emb);
    }

    const session = (note as any).class_sessions;
    const subjectId = session?.subject_id || "unknown";
    const lecturerId = session?.lecturer_id || null;

    // insert chunks
    const rows = chunks.map((c, i) => ({
      user_id: user.id,
      note_id: note.id,
      class_session_id: note.class_session_id,
      subject_id: subjectId,
      lecturer_id: lecturerId,
      chunk_index: i,
      page_number: c.page,
      chunk_text: c.text,
      embedding: allEmb[i] as any,
    }));
    // chunked insert to keep payloads small
    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50);
      const { error: insErr } = await admin.from("note_chunks").insert(slice);
      if (insErr) throw insErr;
    }

    // summary + topics
    const { summary, topics, chapter_hint } = await summarize(fullText, subjectId, apiKey);

    // continuity: find previous session same subject+lecturer
    let continuity = "";
    let prevId: string | null = null;
    if (session) {
      const { data: prev } = await admin
        .from("class_sessions")
        .select("id, session_date, title, summary")
        .eq("user_id", user.id)
        .eq("subject_id", subjectId)
        .eq("lecturer_id", lecturerId)
        .lt("session_date", session.session_date)
        .neq("id", session.id)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev) {
        prevId = prev.id;
        continuity = `Previous lecture (${prev.session_date}): ${prev.title || ""}. ${prev.summary || ""}`.trim();
      }
    }

    await admin.from("notes").update({
      status: "ready",
      extracted_text: fullText.slice(0, 200000),
      ai_summary: summary,
      detected_topics: topics,
    }).eq("id", noteId);

    if (session) {
      const sessionPatch: any = { summary };
      if (continuity) sessionPatch.continuity_context = continuity;
      if (prevId) sessionPatch.previous_session_id = prevId;
      if (!session.title && chapter_hint) sessionPatch.title = chapter_hint;
      await admin.from("class_sessions").update(sessionPatch).eq("id", session.id);
    }

    return new Response(JSON.stringify({ ok: true, chunks: rows.length, topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ingest-note error", e);
    // mark note failed if we know the id
    if (currentNoteId) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        await admin.from("notes").update({ status: "failed", error_message: e?.message?.slice(0, 500) }).eq("id", currentNoteId);
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
