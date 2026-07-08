import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  prelearn: `You are the student's Study OS Pre-Learn AI for Karnataka 2nd PUC (Class 12). Generate comprehensive pre-study material.
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

Be thorough, precise, and aligned with NCERT + Karnataka board. Use simple language.`,

  learn: `You are the student's Study OS Learn Mode AI for Karnataka 2nd PUC (Class 12). Provide deep, detailed explanations.
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

Be thorough and NCERT-aligned. Karnataka board perspective.`,

  practice: `You are the student's Study OS Practice Mode AI for Karnataka 2nd PUC. Generate practice questions.
IMPORTANT: For all math/formulas in questions, options, and explanations, use KaTeX-compatible notation: inline math with single dollar signs $...$, display math with double dollar signs $$...$$. Use \\frac{}{}, \\vec{}, \\hat{}, \\varepsilon, \\times, \\cdot etc. Never use \\[ \\] or \\( \\) delimiters.
Based on the exam type and topic, generate exactly 5 MCQ questions.
For Boards: theory + derivation-based
For KCET: conceptual MCQs + direct formula
For JEE: advanced numericals + multi-concept
Include formula_used and common_mistakes for each question.`,

  test: `You are the student's Study OS Test Mode AI for Karnataka 2nd PUC. Generate exam-simulation questions.
IMPORTANT: For all math/formulas in questions, options, and explanations, use KaTeX-compatible notation: inline math with single dollar signs $...$, display math with double dollar signs $$...$$. Use \\frac{}{}, \\vec{}, \\hat{}, \\varepsilon, \\times, \\cdot etc. Never use \\[ \\] or \\( \\) delimiters.
Generate exactly 10 MCQ questions for a timed test. Mix of difficulty levels.
No hints. Strict exam conditions. Mix easy/medium/hard.`,

  revision: `You are the student's Study OS Revision Mode AI for Karnataka 2nd PUC. Generate rapid recall material.
IMPORTANT: For all math/formulas, use KaTeX-compatible notation: inline math with $...$, display math with $$...$$. Never use \\[ \\] or \\( \\) delimiters.
Focus on high-weightage topics. Based on spaced repetition principles.
Generate flashcards, quick questions, and formula recall items.`,

  mistake: `You are the student's Study OS Mistake Mode AI for Karnataka 2nd PUC. Analyze mistakes and generate correction material.
IMPORTANT: For all math/formulas, use KaTeX-compatible notation: inline math with $...$, display math with $$...$$. Never use \\[ \\] or \\( \\) delimiters.
You will receive a list of wrong answers with the student's response. Analyze each mistake.
Be specific about mistake types. Detect:
- Conceptual errors
- Calculation errors (addition, subtraction, sign errors)
- Formula misuse
- Careless mistakes`,
};

// Tool definitions for structured output
const TOOL_DEFINITIONS: Record<string, any> = {
  practice: {
    type: "function",
    function: {
      name: "generate_practice_questions",
      description: "Generate practice MCQ questions for the student",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                type: { type: "string" },
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct: { type: "string", description: "Just the letter e.g. A, B, C, D" },
                explanation: { type: "string" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                formula_used: { type: "string" },
                common_mistakes: { type: "array", items: { type: "string" } },
              },
              required: ["id", "type", "question", "options", "correct", "explanation", "difficulty"],
            },
          },
        },
        required: ["questions"],
      },
    },
  },
  test: {
    type: "function",
    function: {
      name: "generate_test_questions",
      description: "Generate timed test questions",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct: { type: "string", description: "Just the letter e.g. A, B, C, D" },
                explanation: { type: "string" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                marks: { type: "number" },
                time_expected: { type: "number" },
              },
              required: ["id", "question", "options", "correct", "explanation", "difficulty", "marks", "time_expected"],
            },
          },
          total_marks: { type: "number" },
          total_time: { type: "number" },
        },
        required: ["questions", "total_marks", "total_time"],
      },
    },
  },
  revision: {
    type: "function",
    function: {
      name: "generate_revision_material",
      description: "Generate revision flashcards, quick questions, and formula recall",
      parameters: {
        type: "object",
        properties: {
          flashcards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                front: { type: "string" },
                back: { type: "string" },
                category: { type: "string", enum: ["formula", "definition", "concept"] },
              },
              required: ["id", "front", "back", "category"],
            },
          },
          quick_questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                question: { type: "string" },
                answer: { type: "string" },
                time_limit: { type: "number" },
              },
              required: ["id", "question", "answer", "time_limit"],
            },
          },
          formula_recall: {
            type: "array",
            items: {
              type: "object",
              properties: {
                formula: { type: "string" },
                topic: { type: "string" },
                hint: { type: "string" },
              },
              required: ["formula", "topic", "hint"],
            },
          },
        },
        required: ["flashcards", "quick_questions", "formula_recall"],
      },
    },
  },
  mistake: {
    type: "function",
    function: {
      name: "analyze_mistakes",
      description: "Analyze student mistakes and provide correction material",
      parameters: {
        type: "object",
        properties: {
          analysis: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_id: { type: "number" },
                question: { type: "string" },
                student_answer: { type: "string" },
                correct_answer: { type: "string" },
                mistake_type: { type: "string", enum: ["conceptual", "calculation", "sign_error", "formula_misuse", "careless"] },
                mistake_detail: { type: "string" },
                correction: { type: "string" },
                similar_question: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correct: { type: "string" },
                    explanation: { type: "string" },
                  },
                  required: ["question", "options", "correct", "explanation"],
                },
              },
              required: ["question_id", "question", "student_answer", "correct_answer", "mistake_type", "mistake_detail", "correction"],
            },
          },
          pattern: { type: "string" },
          recommendation: { type: "string", enum: ["revision", "practice", "learn"] },
        },
        required: ["analysis", "pattern", "recommendation"],
      },
    },
  },
};

const TOOL_NAMES: Record<string, string> = {
  practice: "generate_practice_questions",
  test: "generate_test_questions",
  revision: "generate_revision_material",
  mistake: "analyze_mistakes",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode, topic, chapter, subject, examType, messages, mistakes, context } = await req.json();

    if (!mode || !SYSTEM_PROMPTS[mode]) {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MESH_API_KEY = Deno.env.get("MESH_API_KEY");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    let apiKey = MESH_API_KEY;
    if (!apiKey) {
      const { data: dbKey } = await admin.rpc("get_mesh_key");
      if (dbKey) apiKey = dbKey;
    }
    if (!apiKey) throw new Error("MESH_API_KEY is not configured");

    let userMessage = "";
    if (mode === "prelearn" || mode === "learn") {
      userMessage = `Subject: ${subject}\nChapter: ${chapter}\nTopic: ${topic}`;
      if (context) userMessage += `\nStudent Context: ${context}`;
    } else if (mode === "practice") {
      userMessage = `Subject: ${subject}\nChapter: ${chapter}\nTopic: ${topic}\nExam Type: ${examType || "Boards"}`;
      if (context) userMessage += `\nStudent Context: ${context}`;
    } else if (mode === "test") {
      userMessage = `Subject: ${subject}\nChapter: ${chapter}\nTopics: ${topic}`;
      if (examType) userMessage += `\nExam Type: ${examType}`;
    } else if (mode === "revision") {
      userMessage = `Subject: ${subject}\nChapter: ${chapter}\nTopics: ${topic}`;
      if (context) userMessage += `\nLast studied: ${context}`;
    } else if (mode === "mistake") {
      userMessage = `Subject: ${subject}\nChapter: ${chapter}\nMistakes:\n${JSON.stringify(mistakes)}`;
    }

    const isStreaming = mode === "prelearn" || mode === "learn";
    const usesToolCalling = TOOL_DEFINITIONS[mode] !== undefined;

    const chatUrl = "https://api.meshapi.ai/v1/chat/completions";
    const chatModel = "openai/o3-mini";

    const requestBody: any = {
      model: chatModel,
      messages: [
        { role: "developer", content: SYSTEM_PROMPTS[mode] },
        { role: "user", content: userMessage },
      ],
      stream: isStreaming,
    };

    if (usesToolCalling && !isStreaming) {
      requestBody.tools = [TOOL_DEFINITIONS[mode]];
      requestBody.tool_choice = { type: "function", function: { name: TOOL_NAMES[mode] } };
    }

    const response = await fetch(chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isStreaming) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming: extract tool call arguments or fallback to content
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      // Tool calling succeeded — arguments is already valid JSON
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ content: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: return raw content
    const content = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("study-mode error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
