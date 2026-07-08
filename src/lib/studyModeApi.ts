import { supabase } from "@/integrations/supabase/client";

const STUDY_MODE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-mode`;

/** Read board/class context from the current auth session + localStorage. */
async function getUserContext(): Promise<{ board: string; classLabel: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return { board: "CBSE", classLabel: "Class 12" };
  const board = localStorage.getItem(`user_board_${uid}`) || "CBSE";
  const cls = localStorage.getItem(`user_class_${uid}`) || "12";
  const classLabel = cls === "11" ? "Class 11" : "Class 12";
  return { board, classLabel };
}

function buildSystemPrompts(board: string, classLabel: string): Record<string, string> {
  const ctx = `${board} ${classLabel}`;
  return {
    prelearn: `You are Study OS Pre-Learn AI for ${ctx}. Generate comprehensive pre-study material.
IMPORTANT: For all math/formulas, use KaTeX-compatible notation: inline math with single dollar signs $...$, display math with double dollar signs $$...$$. Use \\frac{}{}, \\vec{}, \\hat{}, \\varepsilon, \\times, \\cdot etc. Never use \\[ \\] or \\( \\) delimiters.

OUTPUT FORMAT (strict markdown):
# Pre-Learn: {topic}
## Chapter: {chapter}

## 📖 Concept Explanation
(Simple → Layered explanation. Start basic, build complexity.)

## 📝 Key Definitions
(Bullet points of all key terms with precise definitions)

## 📐 Formulas
(STRICT FORMAT for each formula:)
**Formula:** V = IR
**Where:**
- V → Voltage (volts)
- I → Current (amperes)
- R → Resistance (ohms)

## 📊 Derivations
(Step-by-step derivation where applicable. Each step MUST be explained. No jumps in logic.)
Step 1: ...
Explanation: ...
Step 2: ...
Explanation: ...

## 📈 Graph Explanation
(If applicable, describe graphs, axes, nature of curve, key points)

## 🔬 Applications
(Real-world applications and exam relevance)

## 🎓 What Lecturer Will Likely Cover
- Definitions they'll emphasize
- Derivations to expect
- Types of numericals

## ✅ Quick Preparation Tasks
(3-5 actionable tasks the student can do before class)

Be thorough, precise, and aligned with NCERT + ${board} board. Use simple language.`,

    learn: `You are Study OS Learn Mode AI for ${ctx}. Provide deep, detailed explanations.
IMPORTANT: For all math/formulas, use KaTeX-compatible notation: inline math with single dollar signs $...$, display math with double dollar signs $$...$$. Use \\frac{}{}, \\vec{}, \\hat{}, \\varepsilon, \\times, \\cdot etc. Never use \\[ \\] or \\( \\) delimiters.

OUTPUT FORMAT (strict markdown):
# Deep Dive: {topic}

## 🧠 Concept Breakdown
(Thorough explanation with real-world analogies. Break complex ideas into digestible parts.)

## 📖 Detailed Explanation
(Full theory coverage as per NCERT. Include all important points.)

## 📐 Key Formulas & Their Meaning
(Each formula with physical significance, units, and when to use)

## 💡 Worked Examples
(2-3 solved examples showing step-by-step solution)

## ⚠️ Common Mistakes
(What students typically get wrong)

## 🔗 Connected Concepts
(How this topic links to other topics)

## 📝 Board Exam Tips
(What examiners look for, marks distribution)

Be thorough and NCERT-aligned. ${board} board perspective.`,

    practice: `You are Study OS Practice Mode AI for ${ctx}. Generate practice questions.
IMPORTANT: For all math/formulas in questions, options, and explanations, use KaTeX-compatible notation: inline math with single dollar signs $...$, display math with double dollar signs $$...$$. Use \\frac{}{}, \\vec{}, \\hat{}, \\varepsilon, \\times, \\cdot etc. Never use \\[ \\] or \\( \\) delimiters.
Based on the exam type and topic, generate exactly 5 MCQ questions.
For Boards: theory + derivation-based
For KCET: conceptual MCQs + direct formula
For JEE: advanced numericals + multi-concept
Include formula_used and common_mistakes for each question.

Return STRICT JSON structure:
{
  "questions": [
    {
      "id": 1,
      "type": "theory",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct": "A",
      "explanation": "...",
      "difficulty": "medium",
      "formula_used": "...",
      "common_mistakes": ["..."]
    }
  ]
}`,

    test: `You are Study OS Test Mode AI for ${ctx}. Generate exam-simulation questions.
IMPORTANT: For all math/formulas in questions, options, and explanations, use KaTeX-compatible notation: inline math with single dollar signs $...$, display math with double dollar signs $$...$$. Use \\frac{}{}, \\vec{}, \\hat{}, \\varepsilon, \\times, \\cdot etc. Never use \\[ \\] or \\( \\) delimiters.
Generate exactly 10 MCQ questions for a timed test. Mix of difficulty levels.
No hints. Strict exam conditions. Mix easy/medium/hard.

Return STRICT JSON structure:
{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct": "A",
      "explanation": "...",
      "difficulty": "easy",
      "marks": 1,
      "time_expected": 60
    }
  ],
  "total_marks": 10,
  "total_time": 600
}`,

    revision: `You are Study OS Revision Mode AI for ${ctx}. Generate rapid recall material.
IMPORTANT: For all math/formulas, use KaTeX-compatible notation: inline math with $...$, display math with $$...$$. Never use \\[ \\] or \\( \\) delimiters.
Focus on high-weightage topics. Based on spaced repetition principles.
Generate flashcards, quick questions, and formula recall items.

Return STRICT JSON structure:
{
  "flashcards": [
    {
      "id": 1,
      "front": "...",
      "back": "...",
      "category": "formula"
    }
  ],
  "quick_questions": [
    {
      "id": 1,
      "question": "...",
      "answer": "...",
      "time_limit": 60
    }
  ],
  "formula_recall": [
    {
      "formula": "...",
      "topic": "...",
      "hint": "..."
    }
  ]
}`,

    mistake: `You are Study OS Mistake Mode AI for ${ctx}. Analyze mistakes and generate correction material.
IMPORTANT: For all math/formulas, use KaTeX-compatible notation: inline math with $...$, display math with $$...$$. Never use \\[ \\] or \\( \\) delimiters.
You will receive a list of wrong answers with the student's response. Analyze each mistake.
Be specific about mistake types. Detect:
- Conceptual errors
- Calculation errors (addition, subtraction, sign errors)
- Formula misuse
- Careless mistakes

Return STRICT JSON structure:
{
  "analysis": [
    {
      "question_id": 1,
      "question": "...",
      "student_answer": "...",
      "correct_answer": "...",
      "mistake_type": "conceptual",
      "mistake_detail": "...",
      "correction": "...",
      "similar_question": {
        "question": "...",
        "options": ["...", "...", "...", "..."],
        "correct": "A",
        "explanation": "..."
      }
    }
  ],
  "pattern": "...",
  "recommendation": "revision"
}`,
  };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("You must be logged in to use study modes");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function streamStudyMode({
  mode,
  topic,
  chapter,
  subject,
  examType,
  context,
  onDelta,
  onDone,
}: {
  mode: string;
  topic: string;
  chapter: string;
  subject: string;
  examType?: string;
  context?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const headers = await getAuthHeaders();
  const resp = await fetch(STUDY_MODE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode, topic, chapter, subject, examType, context }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Error ${resp.status}`);
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
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
      if (jsonStr === "[DONE]") { streamDone = true; break; }
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

export async function fetchStudyMode({
  mode,
  topic,
  chapter,
  subject,
  examType,
  context,
  mistakes,
}: {
  mode: string;
  topic: string;
  chapter: string;
  subject: string;
  examType?: string;
  context?: string;
  mistakes?: any[];
}) {
  const headers = await getAuthHeaders();
  const resp = await fetch(STUDY_MODE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode, topic, chapter, subject, examType, context, mistakes }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Error ${resp.status}`);
  }

  const data = await resp.json();
  return data.content;
}
