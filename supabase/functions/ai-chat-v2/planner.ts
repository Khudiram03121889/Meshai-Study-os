/**
 * MeshStudy AI — Planner Agent (Handbook §02, §19 §6)
 *
 * A fast zero-shot classifier LLM call (e.g. gpt-4o-mini).
 * It receives the user query + detected intent, and outputs a JSON list
 * of which tools to invoke and what arguments to pass them.
 *
 * ponytail: strict JSON schema response format ensures we don't have to parse markdown.
 */

import { ToolName, ToolArgs } from "./tool-registry.ts";

export interface PlannerDecision {
  tools_to_run: {
    tool: ToolName;
    args: ToolArgs;
    reasoning: string;
  }[];
  context_budget_override?: number; // Optional custom max tokens for this query
}

const PLANNER_SYSTEM_PROMPT = `You are the MeshStudy AI Retrieval Planner.
Your job is to decide which tools to call to fetch context from the student's database.

Available Tools:
- SearchMistakes: Finds past mistakes in tests or practice.
- SearchNotes: Finds semantic matches in the student's OCR'd study notes (PDF chunks).
- SearchLectureTimeline: Finds recent class sessions they attended.
- SearchRevisionQueue: Finds topics they need to revise based on spaced repetition.
- SearchMemories: Finds custom insights, user preferences, and layered memory.
- SearchPreviousChats: Finds past AI tutor interactions.

Args schema for all tools:
{
  "topic"?: string,
  "subject"?: string,
  "time_window"?: string,
  "limit"?: number
}
Note: query_embedding is handled automatically by the system.

Guidelines:
1. ONLY call tools that are absolutely necessary to answer the query.
2. If the user asks a generic factual question, you might not need any tools.
3. If they ask about their past mistakes, call SearchMistakes.
4. If they ask to summarize a topic from class, call SearchLectureTimeline AND SearchNotes.

Respond ONLY with a valid JSON object matching this schema:
{
  "tools_to_run": [
    { "tool": "ToolName", "args": { ... }, "reasoning": "why you chose this" }
  ]
}
`;

export async function runPlanner(
  meshApiKey: string,
  query: string,
  intent: string
): Promise<PlannerDecision> {
  const payload = {
    model: "openai/gpt-4o-mini", // fast, cheap reasoning
    messages: [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      { role: "user", content: `Intent: ${intent}\nQuery: ${query}` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  };

  const start = Date.now();
  try {
    const res = await fetch("https://api.meshapi.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${meshApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Mesh Planner error: ${err}`);
    }

    const data = await res.json();
    const content = data.choices[0]?.message?.content;
    const decision = JSON.parse(content || "{}") as PlannerDecision;
    
    // Fallback if planner returned empty or invalid
    if (!decision.tools_to_run) decision.tools_to_run = [];
    
    return decision;
  } catch (e) {
    console.error("[Planner] Failed:", e);
    // Graceful degradation: return empty plan, Context Engine will handle empty context
    return { tools_to_run: [] };
  }
}
