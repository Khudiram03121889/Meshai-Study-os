/**
 * MeshStudy AI Event System (Handbook §09)
 *
 * Thin client-side wrapper that records user actions as immutable events.
 * Events are written directly to the `events` table in Supabase.
 * Each event has an event_type and a payload.
 *
 * ponytail: no message broker needed at current scale — direct DB insert
 * is fine for <100 users. Upgrade path: Supabase Webhooks → Redis Pub/Sub.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Event Types (§09 §3) ──────────────────────────────

export type EventType =
  // Academic
  | "lecture.completed"
  | "topic.completed"
  | "formula.learned"
  // Assessment
  | "test.uploaded"
  | "question.answered"
  | "wrong.answer"
  | "practice_session.completed"
  | "quiz.completed"
  // System
  | "note.uploaded"
  | "ocr.completed"
  | "flashcards.generated"
  // AI
  | "ai.explanation_requested"
  | "ai.reflection_completed"
  // Revision
  | "revision.completed"
  | "revision.scheduled";

// ── Emit ───────────────────────────────────────────────

export async function emitEvent(
  eventType: EventType,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // ponytail: silently drop if not authed

    await supabase.from("events").insert({
      user_id: user.id,
      event_type: eventType,
      payload: payload as any,
    });
  } catch (e) {
    // ponytail: events are fire-and-forget, never block the UI
    console.warn("[events] emit failed:", eventType, e);
  }
}
