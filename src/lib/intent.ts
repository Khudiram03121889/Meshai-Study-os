/**
 * MeshStudy AI — Intent Detection Module (Handbook §03, §19 §4)
 *
 * Fast heuristic classifier that bypasses LLMs entirely.
 * Runs in <5ms using regex/keyword matching.
 *
 * ponytail: no ML model needed at this scale. Regex trees cover 90%+ of
 * student queries. Upgrade path: ONNX BERT classifier if accuracy drops.
 */

// ── Intent Hierarchy ──────────────────────────────────

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
  suggested_timeout_ms: number;
}

// ── Patterns ──────────────────────────────────────────

const GREETING_RE = /^(hi|hey|hello|good\s*(morning|afternoon|evening)|sup|yo|namaste|what'?s?\s*up)\b/i;
const GIBBERISH_RE = /^[^a-zA-Z0-9]{3,}$|^(.)\1{4,}$|^[a-z]{1,3}$/i;

const QUIZ_RE = /\b(quiz|test|mcq|generate.*question|create.*question|practice.*question|mock\s*test|sample\s*paper)\b/i;
const SUMMARIZE_RE = /\b(summarize|summary|summarise|tldr|brief|condense|overview\s*of)\b/i;

const MISTAKE_RE = /\b(why.*(wrong|fail|mistake|lost\s*marks|incorrect)|keep\s*(getting|making).*wrong|weak\s*area|where.*(go\s*wrong|struggle)|mistake.*analysis)\b/i;
const STUDY_STRATEGY_RE = /\b(how\s*(should|to|can)\s*(i\s*)?(study|prepare|revise|plan)|study\s*(plan|strategy|schedule|tips)|what.*(study|revise|prepare)\s*next|predict.*teach|what.*tomorrow)\b/i;

const PROBLEM_RE = /\b(solve|calculate|find\s*(the|a)|compute|evaluate|prove|derive|integrate|differentiate|simplify|factori[sz]e|what\s*is\s*the\s*value)\b/i;
const FACT_RE = /\b(what\s*is|define|who\s*(is|was)|when\s*(did|was|is)|list|name\s*the|state\s*the|give\s*the\s*(formula|definition|law))\b/i;

// ── Classifier ────────────────────────────────────────

export function detectIntent(query: string): IntentResult {
  const q = query.trim();

  // Short-circuit: gibberish
  if (!q || GIBBERISH_RE.test(q)) {
    return { intent: "Conversational.Chitchat", confidence: 0.5, requires_planner: false, suggested_timeout_ms: 500 };
  }

  // Greetings — no planner needed
  if (GREETING_RE.test(q) && q.split(/\s+/).length <= 5) {
    return { intent: "Conversational.Greeting", confidence: 0.95, requires_planner: false, suggested_timeout_ms: 500 };
  }

  // Platform actions
  if (QUIZ_RE.test(q)) {
    return { intent: "PlatformAction.GenerateQuiz", confidence: 0.90, requires_planner: true, suggested_timeout_ms: 8000 };
  }
  if (SUMMARIZE_RE.test(q)) {
    return { intent: "PlatformAction.SummarizeNotes", confidence: 0.88, requires_planner: true, suggested_timeout_ms: 5000 };
  }

  // Diagnostic — needs deep memory retrieval
  if (MISTAKE_RE.test(q)) {
    return { intent: "Diagnostic.MistakeAnalysis", confidence: 0.92, requires_planner: true, suggested_timeout_ms: 6000 };
  }
  if (STUDY_STRATEGY_RE.test(q)) {
    return { intent: "Diagnostic.StudyStrategy", confidence: 0.88, requires_planner: true, suggested_timeout_ms: 6000 };
  }

  // Academic — problem solving vs fact retrieval vs conceptual
  if (PROBLEM_RE.test(q)) {
    return { intent: "Academic.ProblemSolving", confidence: 0.85, requires_planner: false, suggested_timeout_ms: 5000 };
  }
  if (FACT_RE.test(q) && q.split(/\s+/).length <= 12) {
    return { intent: "Academic.FactRetrieval", confidence: 0.82, requires_planner: false, suggested_timeout_ms: 3000 };
  }

  // Default: conceptual explanation — safe fallback (§19 §4)
  return { intent: "Academic.ConceptualExplanation", confidence: 0.70, requires_planner: false, suggested_timeout_ms: 5000 };
}
