export type IntentCategory =
  | "Academic.ConceptualExplanation"
  | "Academic.ProblemSolving"
  | "Academic.FactRetrieval"
  | "Diagnostic.MistakeAnalysis"
  | "Diagnostic.StudyStrategy"
  | "PlatformAction.GenerateQuiz"
  | "PlatformAction.SummarizeNotes"
  | "Conversational.Greeting"
  | "Conversational.Chitchat";

export interface IntentResult {
  intent: IntentCategory;
  confidence: number;
  requires_planner: boolean;
}

const GREETING_RE = /^(hi|hey|hello|good\s*(morning|afternoon|evening)|sup|yo|namaste|what'?s?\s*up)\b/i;
const GIBBERISH_RE = /^[^a-zA-Z0-9]{3,}$|^(.)\1{4,}$|^[a-z]{1,3}$/i;
const QUIZ_RE = /\b(quiz|test|mcq|generate.*question|create.*question|practice.*question|mock\s*test|sample\s*paper)\b/i;
const SUMMARIZE_RE = /\b(summarize|summary|summarise|tldr|brief|condense|overview\s*of)\b/i;
const MISTAKE_RE = /\b(why.*(wrong|fail|mistake|lost\s*marks|incorrect)|keep\s*(getting|making).*wrong|weak\s*area|where.*(go\s*wrong|struggle)|mistake.*analysis)\b/i;
const STUDY_STRATEGY_RE = /\b(how\s*(should|to|can)\s*(i\s*)?(study|prepare|revise|plan)|study\s*(plan|strategy|schedule|tips)|what.*(study|revise|prepare)\s*next|predict.*teach|what.*tomorrow)\b/i;
const PROBLEM_RE = /\b(solve|calculate|find\s*(the|a)|compute|evaluate|prove|derive|integrate|differentiate|simplify|factori[sz]e|what\s*is\s*the\s*value)\b/i;
const FACT_RE = /\b(what\s*is|define|who\s*(is|was)|when\s*(did|was|is)|list|name\s*the|state\s*the|give\s*the\s*(formula|definition|law))\b/i;

export function detectIntent(query: string): IntentResult {
  const q = query.trim();
  if (!q || GIBBERISH_RE.test(q)) return { intent: "Conversational.Chitchat", confidence: 0.5, requires_planner: false };
  if (GREETING_RE.test(q) && q.split(/\s+/).length <= 5) return { intent: "Conversational.Greeting", confidence: 0.95, requires_planner: false };
  if (QUIZ_RE.test(q)) return { intent: "PlatformAction.GenerateQuiz", confidence: 0.90, requires_planner: true };
  if (SUMMARIZE_RE.test(q)) return { intent: "PlatformAction.SummarizeNotes", confidence: 0.88, requires_planner: true };
  if (MISTAKE_RE.test(q)) return { intent: "Diagnostic.MistakeAnalysis", confidence: 0.92, requires_planner: true };
  if (STUDY_STRATEGY_RE.test(q)) return { intent: "Diagnostic.StudyStrategy", confidence: 0.88, requires_planner: true };
  if (PROBLEM_RE.test(q)) return { intent: "Academic.ProblemSolving", confidence: 0.85, requires_planner: false };
  if (FACT_RE.test(q) && q.split(/\s+/).length <= 12) return { intent: "Academic.FactRetrieval", confidence: 0.82, requires_planner: false };
  return { intent: "Academic.ConceptualExplanation", confidence: 0.70, requires_planner: true }; // default to planner
}

export async function detectSubjectLLM(
  query: string,
  history: any[],
  apiKey: string
): Promise<"physics" | "chemistry" | "mathematics" | "general"> {
  const chatHistoryContext = history
    .slice(-3)
    .map(m => `${m.role === "user" ? "Student" : "Tutor"}: ${m.message || m.content}`)
    .join("\n");

  const prompt = `You are an academic classifier. Classify the subject of the student's query based on the query and chat history.
Chat History:
${chatHistoryContext}

Student's Query: "${query}"

Respond with exactly one of the following words: "physics", "chemistry", "mathematics", or "general". Do not include any punctuation, formatting, or extra text.`;

  const url = "https://api.meshapi.ai/v1/chat/completions";
  const model = "openai/gpt-4o-mini";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 5,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.error("[detectSubjectLLM] API returned non-OK status:", res.status);
      return "general";
    }
    const json = await res.json();
    const content = (json.choices?.[0]?.message?.content || "").trim().toLowerCase();
    
    if (content.includes("mathematics") || content.includes("math")) return "mathematics";
    if (content.includes("chemistry") || content.includes("chem")) return "chemistry";
    if (content.includes("physics") || content.includes("phys")) return "physics";
    return "general";
  } catch (e) {
    console.error("[detectSubjectLLM] Failed:", e);
    return "general";
  }
}


