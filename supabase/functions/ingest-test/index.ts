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

async function refineText(text: string, apiKey: string): Promise<string> {
  const prompt = `You are a professional text formatter. You are given a raw OCR-extracted transcription of an exam paper or worksheet.
Your task is to refine it:
1. Fix any typos or OCR reading errors.
2. Format all mathematical equations into clean KaTeX/LaTeX formatting. Use inline math with single dollar signs $...$, display math with double dollar signs $$...$$.
3. Preserve the original structure of the questions, marks, and sections, making it clean, structured, and readable in Markdown.
4. Do NOT solve the questions, summarize or add commentary. Return ONLY the refined exam paper content.

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

async function analyseTest(text: string, subject: string): Promise<{
  questions: { question_text: string; topic: string; difficulty: string; marks: number | null }[];
  analysis: string;
  paper_type: string;
}> {
  const prompt = `You are analyzing a ${subject} document for Karnataka 2nd PUC. It may be ANY of:
- a formal exam / board / KCET / JEE / mid-term / mock test paper, OR
- a practice worksheet / assignment / problem set / classroom handout / homework sheet.

First infer which type from structure, headings, marks scheme, and instructions. Then extract EVERY question regardless of format (MCQ, short answer, long answer, numerical, derivation, fill-in-the-blank, true/false). Treat worksheet/practice problems as fully valid questions — they are equally useful for pattern analysis and for the Test Mode generator.

Return STRICT JSON only:
{
  "paper_type": "exam" | "worksheet" | "assignment" | "mock_test" | "unknown",
  "questions": [
    { "question_text": "full question", "topic": "topic/chapter name", "difficulty": "easy|medium|hard", "marks": number-or-null }
  ],
  "analysis": "2-4 sentence summary: state clearly whether this is an exam paper or a practice worksheet, what it tested/practiced, repeated topics, and difficulty distribution"
}

DOCUMENT:
"""
${text.slice(0, 14000)}
"""`;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let apiKey = MESH_API_KEY;
  if (!apiKey) {
    const { data: dbKey } = await admin.rpc("get_mesh_key");
    if (dbKey) apiKey = dbKey;
  }
  if (!apiKey) throw new Error("MESH_API_KEY is not configured");
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
    console.error("analyseTest failed", res.status, await res.text());
    return { questions: [], analysis: "", paper_type: "unknown" };
  }
  const j = await res.json();
  try {
    const parsed = parseJsonResponse(j.choices[0]?.message?.content || "{}");
    return {
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      analysis: parsed.analysis || "",
      paper_type: parsed.paper_type || "unknown",
    };
  } catch {
    return { questions: [], analysis: j.choices[0]?.message?.content || "", paper_type: "unknown" };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let currentTestPaperId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { testPaperId } = await req.json();
    currentTestPaperId = testPaperId;
    if (!testPaperId) return new Response(JSON.stringify({ error: "testPaperId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let meshApiKey = MESH_API_KEY;
    if (!meshApiKey) {
      const { data: dbKey } = await admin.rpc("get_mesh_key");
      if (dbKey) meshApiKey = dbKey;
    }

    const { data: paper, error: pErr } = await admin.from("test_papers").select("*").eq("id", testPaperId).eq("user_id", user.id).single();
    if (pErr || !paper) return new Response(JSON.stringify({ error: "Test paper not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ext = paper.storage_path?.split(".").pop()?.toLowerCase() || "pdf";
    const mimeType = ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : "application/pdf";

    await admin.from("test_papers").update({ status: "processing" }).eq("id", testPaperId);

    if (!paper.storage_path) throw new Error("No storage path on test paper");
    const { data: file, error: dlErr } = await admin.storage.from("notes-pdfs").download(paper.storage_path);
    if (dlErr || !file) throw new Error(`Download failed: ${dlErr?.message}`);
    const buf = new Uint8Array(await file.arrayBuffer());

    let fullText = "";
    try {
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      fullText = Array.isArray(text) ? text.join("\n\n") : (text as string);
    } catch (e) {
      console.error("PDF parse failed natively, will try OCR fallback", e);
    }

    if (!fullText.trim() || fullText.trim().length < 50) {
      console.log("No readable text found natively. Attempting OCR fallback via AI Gateway...");
      
      const base64 = encodeBase64(buf);
      
      const apiKey = meshApiKey;
      if (!apiKey) throw new Error("API key not configured");
      const ocrUrl = "https://api.meshapi.ai/v1/chat/completions";
      const callOcr = async (model: string) => {
        const isPdf = mimeType.includes("pdf");
        const ocrPrompt = isPdf
          ? "Please perform OCR and extract ALL the text from this PDF document, exactly as written. Ensure order and structure are preserved. Do not add any extra commentary."
          : "Please perform OCR and extract ALL the text from this image, exactly as written. Ensure order and structure are preserved. Do not add any extra commentary.";
        const dataUri = `data:${mimeType};base64,${base64}`;

        const ocrRes = await fetch(ocrUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ 
              role: "user", 
              content: [
                { type: "text", text: ocrPrompt },
                { type: "image_url", image_url: { url: dataUri } }
              ] 
            }]
          }),
        });
        
        if (!ocrRes.ok) {
          throw new Error("OCR call returned status " + ocrRes.status + ": " + await ocrRes.text());
        }
        
        const j = await ocrRes.json();
        return j.choices?.[0]?.message?.content || "";
      };

      try {
        let extractedContent = "";
        try {
          console.log("Calling google/gemini-2.5-flash for OCR...");
          extractedContent = await callOcr("google/gemini-2.5-flash");
        } catch (err: any) {
          console.warn("Gemini OCR failed, retrying with gpt-4o:", err?.message);
          extractedContent = await callOcr("openai/gpt-4o");
        }

        if (!extractedContent.trim() || extractedContent.trim().length < 50) {
           throw new Error("No readable text found even after OCR.");
        }
        
        console.log(`OCR extracted ${extractedContent.length} chars. Refining with gpt-4o...`);
        try {
          extractedContent = await refineText(extractedContent, apiKey);
          console.log(`Refined text length: ${extractedContent.length} chars`);
        } catch (refErr) {
          console.warn("Refinement failed, using raw OCR text:", refErr);
        }

        fullText = extractedContent;
      } catch (e: any) {
        throw new Error("This PDF appears to be a scanned document or has no selectable text. Digital PDFs are required for text extraction. Please use a digital PDF or OCR the file before uploading.");
      }
    }

    const { questions, analysis, paper_type } = await analyseTest(fullText, paper.subject_id || "general");
    const typeLabel = paper_type && paper_type !== "unknown" ? `[${paper_type.replace(/_/g, " ")}] ` : "";
    const annotatedAnalysis = `${typeLabel}${analysis}`.trim();

    // count repeated_frequency by comparing topics against existing test_questions for this user
    const { data: existingQs } = await admin.from("test_questions").select("topic").eq("user_id", user.id);
    const topicCount: Record<string, number> = {};
    (existingQs || []).forEach((q: any) => { if (q.topic) topicCount[q.topic.toLowerCase()] = (topicCount[q.topic.toLowerCase()] || 0) + 1; });

    const rows = questions.map((q) => ({
      user_id: user.id,
      test_paper_id: testPaperId,
      question_text: q.question_text,
      topic: q.topic || null,
      difficulty: q.difficulty || null,
      marks: q.marks || null,
      repeated_frequency: q.topic ? (topicCount[q.topic.toLowerCase()] || 0) + 1 : 1,
    }));
    if (rows.length) {
      for (let i = 0; i < rows.length; i += 50) {
        const slice = rows.slice(i, i + 50);
        const { error: insErr } = await admin.from("test_questions").insert(slice);
        if (insErr) throw insErr;
      }
    }

    await admin.from("test_papers").update({
      status: "ready",
      extracted_text: fullText.slice(0, 200000),
      ai_analysis: annotatedAnalysis,
    }).eq("id", testPaperId);

    return new Response(JSON.stringify({ ok: true, questions: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ingest-test error", e);
    if (currentTestPaperId) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        await admin.from("test_papers").update({ status: "failed", ai_analysis: e?.message?.slice(0, 500) }).eq("id", currentTestPaperId);
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
