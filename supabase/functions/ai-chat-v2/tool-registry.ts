/**
 * StudyOS V2 — Tool Registry (Handbook §19 §7)
 *
 * Every retrieval tool the Planner can invoke. Each tool has:
 * - name, description
 * - execute function (returns data from Supabase)
 * - estimated token cost per result
 *
 * ponytail: tools query Supabase directly via service_role client.
 * No abstraction layer beyond this registry.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface ToolResult {
  tool: string;
  data: any[];
  tokens_estimate: number;
}

export interface ToolArgs {
  topic?: string;
  subject?: string;
  time_window?: string; // e.g. "30d"
  limit?: number;
  query_embedding?: number[];
}

// ── Tool Definitions ──────────────────────────────────

export async function executeSearchMistakes(
  admin: SupabaseClient, userId: string, args: ToolArgs
): Promise<ToolResult> {
  let query = admin
    .from("memories")
    .select("content, memory_type, confidence_score, subject_slug, metadata, created_at")
    .eq("user_id", userId)
    .in("memory_type", ["mistake", "weak_area", "confusion", "exam_repeated"]);

  if (args.subject) query = query.eq("subject_slug", args.subject);
  if (args.topic) query = query.ilike("content", `%${args.topic}%`);

  const { data } = await query.order("created_at", { ascending: false }).limit(args.limit || 8);
  
  const getTopic = (m: any) => {
    if (m.metadata?.topic) return m.metadata.topic;
    if (m.content.startsWith("Topic: ")) {
      return m.content.split("\n")[0].replace("Topic: ", "").trim();
    }
    return m.content;
  };

  const getNotes = (m: any) => {
    if (m.content.startsWith("Topic: ")) {
      const lines = m.content.split("\n");
      if (lines.length > 1 && lines[1].startsWith("Notes: ")) {
        return lines[1].replace("Notes: ", "").trim();
      }
    }
    return m.content;
  };

  const results = (data || []).map((m: any) => ({
    topic: getTopic(m),
    notes: getNotes(m),
    memory_type: m.memory_type,
    confidence_score: m.confidence_score,
    subject_id: m.subject_slug,
  }));

  return { tool: "SearchMistakes", data: results, tokens_estimate: results.length * 80 };
}

export async function executeSearchNotes(
  admin: SupabaseClient, userId: string, args: ToolArgs
): Promise<ToolResult> {
  if (!args.query_embedding) return { tool: "SearchNotes", data: [], tokens_estimate: 0 };

  const { data } = await admin.rpc("match_note_chunks", {
    query_embedding: args.query_embedding as any,
    match_user_id: userId,
    match_count: args.limit || 6,
    filter_subject: args.subject || null,
    filter_note_id: null,
  });
  const results = data || [];
  return { tool: "SearchNotes", data: results, tokens_estimate: results.length * 120 };
}

export async function executeSearchLectureTimeline(
  admin: SupabaseClient, userId: string, args: ToolArgs
): Promise<ToolResult> {
  let query = admin
    .from("class_sessions")
    .select("session_date, subject_id, title, summary, lecturers(name)")
    .eq("user_id", userId);

  if (args.subject) query = query.eq("subject_id", args.subject);

  const { data } = await query.order("session_date", { ascending: false }).limit(args.limit || 10);
  const results = data || [];
  return { tool: "SearchLectureTimeline", data: results, tokens_estimate: results.length * 60 };
}

export async function executeSearchRevisionQueue(
  admin: SupabaseClient, userId: string, args: ToolArgs
): Promise<ToolResult> {
  let query = admin
    .from("memories")
    .select("content, confidence_score, subject_slug, metadata, updated_at, created_at")
    .eq("user_id", userId)
    .eq("memory_type", "revision");

  if (args.subject) query = query.eq("subject_slug", args.subject);

  const { data } = await query.order("confidence_score", { ascending: true }).limit(args.limit || 10);
  
  const getTopic = (m: any) => {
    if (m.metadata?.topic) return m.metadata.topic;
    if (m.content.startsWith("Revision needed for: ")) {
      return m.content.split(". Confidence:")[0].replace("Revision needed for: ", "").trim();
    }
    return m.content;
  };

  const results = (data || []).map((m: any) => ({
    topic: getTopic(m),
    subject_id: m.subject_slug,
    confidence_level: m.confidence_score,
    revision_count: m.metadata?.revision_count || 0,
    last_revised: m.metadata?.last_revised || m.updated_at || m.created_at,
  }));

  return { tool: "SearchRevisionQueue", data: results, tokens_estimate: results.length * 40 };
}

export async function executeSearchMemories(
  admin: SupabaseClient, userId: string, args: ToolArgs
): Promise<ToolResult> {
  if (!args.query_embedding) return { tool: "SearchMemories", data: [], tokens_estimate: 0 };

  const { data } = await admin.rpc("match_memories", {
    query_embedding: args.query_embedding as any,
    match_user_id: userId,
    match_count: args.limit || 5,
    filter_memory_type: null,
    filter_subject: args.subject || null,
  });
  const results = data || [];
  return { tool: "SearchMemories", data: results, tokens_estimate: results.length * 100 };
}

export async function executeSearchPreviousChats(
  admin: SupabaseClient, userId: string, args: ToolArgs
): Promise<ToolResult> {
  // Read from the actual chat storage used by the global AI Tutor (chat_messages).
  // Fall back to legacy ai_chat_history if present.
  const limit = args.limit || 8;
  let query = admin
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", userId);

  if (args.topic) query = query.ilike("content", `%${args.topic}%`);

  const { data } = await query.order("created_at", { ascending: false }).limit(limit);
  // Normalize to { role, message } for the context engine
  const results = (data || []).reverse().map((r: any) => ({
    role: r.role,
    message: r.content,
    created_at: r.created_at,
  }));
  return { tool: "SearchPreviousChats", data: results, tokens_estimate: results.length * 100 };
}

// ── Tool Dispatcher ───────────────────────────────────

export type ToolName =
  | "SearchMistakes"
  | "SearchNotes"
  | "SearchLectureTimeline"
  | "SearchRevisionQueue"
  | "SearchMemories"
  | "SearchPreviousChats";

const TOOL_MAP: Record<ToolName, (admin: SupabaseClient, userId: string, args: ToolArgs) => Promise<ToolResult>> = {
  SearchMistakes: executeSearchMistakes,
  SearchNotes: executeSearchNotes,
  SearchLectureTimeline: executeSearchLectureTimeline,
  SearchRevisionQueue: executeSearchRevisionQueue,
  SearchMemories: executeSearchMemories,
  SearchPreviousChats: executeSearchPreviousChats,
};

export async function executeTool(
  toolName: ToolName, admin: SupabaseClient, userId: string, args: ToolArgs
): Promise<ToolResult> {
  const fn = TOOL_MAP[toolName];
  if (!fn) return { tool: toolName, data: [], tokens_estimate: 0 };
  return fn(admin, userId, args);
}
