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

    const { text, image, lecturers = [], subjects = [] } = await req.json();
    if (!text?.trim() && !image?.trim()) {
      return new Response(JSON.stringify({ error: "Either text or image notes are required" }), {
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

    const url = "https://api.meshapi.ai/v1/chat/completions";
    const model = "openai/gpt-4o-mini"; // mini supports vision and is fast/accurate for OCR

    const lecturersList = lecturers.map((l: any) => `- Name: ${l.name}, ID: ${l.id}, Subject ID: ${l.subject_id}`).join("\n");
    
    // Build a compact representation of the syllabus
    const syllabusList = subjects.map((s: any) => {
      const chaptersStr = s.chapters.map((c: any) => {
        const topicsStr = c.topics.map((t: any) => `    * Topic: ${t.name}, ID: ${t.id}`).join("\n");
        return `  - Chapter: ${c.name}, ID: ${c.id}\n${topicsStr}`;
      }).join("\n");
      return `- Subject: ${s.name}, ID: ${s.id}\n${chaptersStr}`;
    }).join("\n");

    const prompt = `You are a StudyOS Class Log Parser.
Your job is to analyze a student's description and/or the uploaded image of their handwritten class notes/whiteboard, and map it to a structured JSON object.

Available Subjects, Chapters, and Topics:
${syllabusList}

Available Lecturers:
${lecturersList}

Student Text Description:
"${text || "No text description provided. Transcribe and analyze the uploaded notes/whiteboard image directly."}"

Rules:
1. If an image is uploaded, perform OCR on the visible notes/whiteboard topics, text, or equations to identify the concepts covered.
2. Identify the subject (matching Subject ID).
3. Identify the lecturer (matching Lecturer ID) — check if any lecturer name is mentioned in the text/notes.
4. Identify the chapter (matching Chapter ID) and the specific topics taught (matching Topic IDs). Select ALL topics that are mentioned or are subsets of the topics mentioned.
5. Estimate the understanding score (1 to 5) based on the sentiment of the student's text, or notes quality (default to 3 if neutral/unspecified).
   - Sentiment: "totally lost", "didn't understand", "no clue", "struggled", "so hard", "tough" -> 1 or 2
   - Sentiment: "okay", "average", "so-so", "fine" -> 3
   - Sentiment: "got it", "understood", "clear", "great", "easy" -> 4 or 5
6. Extract brief notes summarizing the key topics covered in the session.

Return a STRICT JSON object only (no markdown code blocks, no commentary) matching this schema:
{
  "subjectId": "matching Subject ID or null",
  "lecturerId": "matching Lecturer ID or null",
  "chapterId": "matching Chapter ID or null",
  "topicIds": ["matching Topic ID 1", "matching Topic ID 2", ...],
  "understanding": number (1-5),
  "notes": "extracted brief notes or null"
}
If no matches are found, set them to null.`;

    const messageContent: any[] = [
      { type: "text", text: prompt }
    ];

    if (image?.trim()) {
      const imageUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
      messageContent.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: messageContent }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`AI failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    const result = parseJsonResponse(j.choices?.[0]?.message?.content || "{}");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("parse-quick-log error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, { port: parseInt(Deno.env.get("PORT") || "8000") });
