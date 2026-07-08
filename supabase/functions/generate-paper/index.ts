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

interface GenQ {
  id: number;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  topic: string;
  difficulty: string;
  marks: number;
  time_expected: number;
  source: "past_paper" | "pattern" | "syllabus";
  source_ref?: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPrompt(opts: {
  subject: string;
  chapter: string;
  examType: string;
  count: number;
  pastSamples: { question_text: string; topic: string | null; difficulty: string | null; marks: number | null }[];
  topicStats: { topic: string; freq: number }[];
  reusedTexts: string[];
}) {
  const { subject, chapter, examType, count, pastSamples, topicStats, reusedTexts } = opts;
  const stats = topicStats
    .slice(0, 12)
    .map((t) => `- ${t.topic}: appeared ${t.freq}x in past papers`)
    .join("\n") || "(no past-paper history available)";
  const samples = pastSamples
    .slice(0, 15)
    .map((q, i) => `${i + 1}. [${q.topic || "?"} | ${q.difficulty || "?"} | ${q.marks ?? "?"}m] ${q.question_text.slice(0, 280)}`)
    .join("\n") || "(no samples)";
  const reused = reusedTexts.length
    ? `\nThe following ${reusedTexts.length} past-paper questions are ALREADY in the test (do NOT duplicate them):\n${reusedTexts.map((t, i) => `${i + 1}. ${t.slice(0, 180)}`).join("\n")}`
    : "";

  return `You are an expert exam paper setter for Karnataka 2nd PUC ${subject}.

Generate exactly ${count} MULTIPLE CHOICE questions for a ${examType} style test on the chapter "${chapter}".

PAST-PAPER PATTERN ANALYSIS (use this to weight topics & difficulty realistically):
${stats}

STYLE ANCHORS — sample questions from past papers (match this tone, depth & wording style):
${samples}
${reused}

STRICT RULES:
- Exactly 4 options per question (A,B,C,D style — return as a 4-element array)
- "correct" must be one of "A","B","C","D"
- Mix difficulty per past-paper distribution (roughly 30% easy, 50% medium, 20% hard for ${examType})
- For competitive (JEE/KCET): tougher application & multi-step reasoning, single-correct
- For Boards: conceptual + direct from textbook style
- Each question tagged with its topic (use topics from the analysis when possible)
- marks: 1 for competitive, 1-2 for boards
- time_expected (seconds): ${examType === "Boards" ? "60" : "72"} on average
- "source" must be "pattern" (we'll add past_paper ones separately)
- explanation: 1-3 lines, KaTeX for math via $...$

Return STRICT JSON only:
{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "options": ["...","...","...","..."],
      "correct": "A",
      "explanation": "...",
      "topic": "...",
      "difficulty": "easy|medium|hard",
      "marks": 1,
      "time_expected": 72,
      "source": "pattern"
    }
  ]
}`;
}

async function callAI(prompt: string): Promise<any[]> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let apiKey = MESH_API_KEY;
  if (!apiKey) {
    const { data: dbKey } = await admin.rpc("get_mesh_key");
    if (dbKey) apiKey = dbKey;
  }
  if (!apiKey) throw new Error("MESH_API_KEY is not configured");
  const url = "https://api.meshapi.ai/v1/chat/completions";
  const model = "openai/o3-mini";

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
    if (res.status === 429) throw new Error("AI rate limit, please retry shortly.");
    throw new Error(`AI error ${res.status}`);
  }
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  return Array.isArray(parsed.questions) ? parsed.questions : [];
}

// Turn a raw past-paper question (text only) into a 4-option MCQ
async function mcqFromPastQuestions(
  subject: string,
  rawQuestions: { question_text: string; topic: string | null; difficulty: string | null; marks: number | null; paper_title?: string }[],
): Promise<GenQ[]> {
  if (!rawQuestions.length) return [];
  const list = rawQuestions.map((q, i) => `${i + 1}. [${q.topic || "?"}] ${q.question_text.slice(0, 400)}`).join("\n");
  const prompt = `You are converting past Karnataka 2nd PUC ${subject} exam questions into clean 4-option MCQs.

For EACH numbered question below, output one MCQ object preserving the original concept tested. Add 4 plausible options, mark the correct one, and write a short explanation.

QUESTIONS:
${list}

Return STRICT JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "rewritten as a clean MCQ stem",
      "options": ["...","...","...","..."],
      "correct": "A",
      "explanation": "...",
      "topic": "...",
      "difficulty": "easy|medium|hard",
      "marks": 1,
      "time_expected": 72,
      "source": "past_paper"
    }
  ]
}
Keep ids matching the input numbering.`;
  const arr = await callAI(prompt);
  return arr.map((q: any, idx: number) => ({
    ...q,
    source: "past_paper" as const,
    source_ref: rawQuestions[idx]?.paper_title || "Past paper",
  }));
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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { subjectId, subjectName, chapterId, chapterName, examType, topicHint } = body as {
      subjectId: string; subjectName: string; chapterId?: string; chapterName: string; examType: string; topicHint?: string;
    };

    const isCompetitive = examType !== "Boards";
    const totalCount = isCompetitive ? 60 : 30;
    const perQSeconds = isCompetitive ? 72 : 60;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Pull this user's past-paper questions for this subject
    const { data: papers } = await admin
      .from("test_papers")
      .select("id, title, subject_id")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId);
    const paperIds = (papers || []).map((p) => p.id);
    const paperTitleMap: Record<string, string> = {};
    (papers || []).forEach((p) => { paperTitleMap[p.id] = p.title || "Past paper"; });

    let allPast: any[] = [];
    if (paperIds.length) {
      const { data: qs } = await admin
        .from("test_questions")
        .select("id, test_paper_id, question_text, topic, difficulty, marks")
        .in("test_paper_id", paperIds);
      allPast = qs || [];
    }

    // Filter relevance by topic / chapter keyword match
    const needle = (chapterName + " " + (topicHint || "")).toLowerCase();
    const tokens = needle.split(/[^a-z0-9]+/).filter((t) => t.length > 3);
    const relevant = allPast.filter((q) => {
      const hay = ((q.topic || "") + " " + (q.question_text || "")).toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });

    // Topic frequency stats from ALL past papers for this subject (pattern signal)
    const topicFreq: Record<string, number> = {};
    allPast.forEach((q) => {
      if (q.topic) topicFreq[q.topic] = (topicFreq[q.topic] || 0) + 1;
    });
    const topicStats = Object.entries(topicFreq)
      .map(([topic, freq]) => ({ topic, freq }))
      .sort((a, b) => b.freq - a.freq);

    // Decide how many to reuse vs generate (~25% reused, capped)
    const reuseTarget = Math.min(Math.floor(totalCount * 0.25), relevant.length, 15);
    const reuseSelected = shuffle(relevant).slice(0, reuseTarget).map((q) => ({
      question_text: q.question_text,
      topic: q.topic,
      difficulty: q.difficulty,
      marks: q.marks,
      paper_title: paperTitleMap[q.test_paper_id] || "Past paper",
    }));

    // Generate MCQs from past questions in parallel with pattern generation
    const remaining = totalCount - reuseTarget;
    const sampleForStyle = shuffle(allPast).slice(0, 15);

    const reusedTexts = reuseSelected.map((r) => r.question_text);
    const patternPrompt = buildPrompt({
      subject: subjectName,
      chapter: chapterName,
      examType,
      count: remaining,
      pastSamples: sampleForStyle,
      topicStats,
      reusedTexts,
    });

    // For large counts (>30), split into 2 parallel calls
    let generated: any[] = [];
    const reusePromise = reuseSelected.length ? mcqFromPastQuestions(subjectName, reuseSelected) : Promise.resolve([]);
    if (remaining > 30) {
      const half = Math.floor(remaining / 2);
      const promptA = buildPrompt({ subject: subjectName, chapter: chapterName, examType, count: half, pastSamples: sampleForStyle, topicStats, reusedTexts });
      const promptB = buildPrompt({ subject: subjectName, chapter: chapterName, examType, count: remaining - half, pastSamples: sampleForStyle, topicStats, reusedTexts });
      const [reused, a, b] = await Promise.all([reusePromise, callAI(promptA), callAI(promptB)]);
      generated = [...a, ...b];
      var reusedMCQs = reused as GenQ[];
    } else {
      const [reused, gen] = await Promise.all([reusePromise, callAI(patternPrompt)]);
      generated = gen;
      var reusedMCQs = reused as GenQ[];
    }

    // Merge & renumber
    const merged: GenQ[] = [];
    let nextId = 1;
    for (const q of reusedMCQs) {
      if (!q?.options || q.options.length !== 4) continue;
      merged.push({ ...q, id: nextId++, source: "past_paper", time_expected: perQSeconds, marks: q.marks || 1 });
    }
    for (const q of generated) {
      if (!q?.options || q.options.length !== 4) continue;
      merged.push({ ...q, id: nextId++, source: q.source || "pattern", time_expected: perQSeconds, marks: q.marks || 1 });
    }

    // Trim or pad to target
    let final = merged.slice(0, totalCount);
    // If still short, ask AI for top-up
    if (final.length < totalCount) {
      const need = totalCount - final.length;
      const topupPrompt = buildPrompt({
        subject: subjectName,
        chapter: chapterName,
        examType,
        count: need,
        pastSamples: sampleForStyle,
        topicStats,
        reusedTexts: final.map((q) => q.question),
      });
      try {
        const more = await callAI(topupPrompt);
        for (const q of more) {
          if (final.length >= totalCount) break;
          if (!q?.options || q.options.length !== 4) continue;
          final.push({ ...q, id: final.length + 1, source: "syllabus", time_expected: perQSeconds, marks: q.marks || 1 });
        }
      } catch (e) { console.warn("top-up failed", e); }
    }

    // Final renumber for cleanliness
    final = final.map((q, i) => ({ ...q, id: i + 1 }));
    const total_time = final.reduce((s, q) => s + (q.time_expected || perQSeconds), 0);

    return new Response(JSON.stringify({
      questions: final,
      total_time,
      meta: {
        target: totalCount,
        delivered: final.length,
        past_paper_count: final.filter((q) => q.source === "past_paper").length,
        pattern_count: final.filter((q) => q.source === "pattern").length,
        syllabus_count: final.filter((q) => q.source === "syllabus").length,
        past_paper_pool: allPast.length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("generate-paper error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
