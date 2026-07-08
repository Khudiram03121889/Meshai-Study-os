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

export function detectSubject(query: string, history: any[]): "physics" | "chemistry" | "mathematics" | null {
  const text = (query + " " + history.map(h => h.content || h.message || "").join(" ")).toLowerCase();
  
  // Chemistry keywords
  const chemKeywords = [
    "reaction", "acid", "base", "condens", "bond", "atom", "molecule", "aldol", "ketone", "aldehyde", "ether", 
    "ester", "alcohol", "hydrocarbon", "alkane", "alkene", "alkyne", "periodic", "element", "iupac", "sodium", 
    "chlorin", "carbon", "chem", "orbital", "compound", "catalyst", "synthesis", "thermodynamics", "entropy",
    "kinetics", "oxidation", "reduction", "redox", "anode", "cathode", "titration", "solution", "solvent", 
    "solute", "equilibrium", "ph value"
  ];
  
  // Math keywords
  const mathKeywords = [
    "vector", "matrix", "matrices", "derivative", "integral", "integrate", "differentiate", "calculus", 
    "trigonomet", "sine", "cosine", "tangent", "logarithm", "log", "theorem", "proof", "triangle", "geometry", 
    "algebra", "probability", "statistics", "equation", "cross product", "dot product", "limit", "function",
    "determinant", "geometric", "arithmetic", "permutation", "combination", "binomial"
  ];

  // Physics keywords
  const physKeywords = [
    "force", "energy", "velocity", "acceleration", "gravity", "mass", "friction", "charge", "electric", 
    "magnetic", "field", "coulomb", "ohm", "kirchhoff", "voltage", "current", "circuit", "amperes", "watts", 
    "resistance", "resistor", "newton", "joule", "thermodynamic", "wave", "light", "optics", "quantum", 
    "momentum", "motion", "kinematics", "capacitance", "capacitor", "inductance", "inductor", "refraction",
    "reflection", "prism", "lens", "relativity", "sound", "frequency", "wavelength"
  ];

  let chemCount = 0;
  let mathCount = 0;
  let physCount = 0;

  for (const w of chemKeywords) {
    if (text.includes(w)) chemCount++;
  }
  for (const w of mathKeywords) {
    if (text.includes(w)) mathCount++;
  }
  for (const w of physKeywords) {
    if (text.includes(w)) physCount++;
  }

  if (chemCount > mathCount && chemCount > physCount) return "chemistry";
  if (mathCount > chemCount && mathCount > physCount) return "mathematics";
  if (physCount > chemCount && physCount > mathCount) return "physics";

  return null;
}

