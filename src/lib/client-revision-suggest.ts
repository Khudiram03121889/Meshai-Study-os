import { supabase } from "@/integrations/supabase/client";

/** ponytail: Call secure Supabase Edge Function to avoid exposing Mesh API key on the client */
export async function clientGenerateRevision(opts: {
  userId: string;
  topic: string;
  subject: string | null;
  action: "flashcards" | "viva" | "formulas" | "summary";
}) {
  const { userId, topic, subject, action } = opts;
  const localCacheKey = `rev_cache:${userId}:${action}:${topic.toLowerCase()}`;

  // 1. Try local storage cache first for offline/instant load (Voice of Customer backlog)
  try {
    const cached = localStorage.getItem(localCacheKey);
    if (cached) {
      console.log(`[Offline Cache Hit] Loaded ${action} for ${topic}`);
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn("Local storage cache read failed:", e);
  }

  // 2. Fetch from secure edge function
  const { data, error } = await supabase.functions.invoke("revision-suggest", {
    body: { action, topic, subject }
  });

  if (error) {
    console.error("revision-suggest invoke failed:", error);
    throw new Error(error.message || "Failed to generate revision suggestion");
  }

  const content = data?.content || null;

  // 3. Store in local storage cache
  if (content) {
    try {
      localStorage.setItem(localCacheKey, JSON.stringify(content));
    } catch (e) {
      console.warn("Local storage cache write failed:", e);
    }
  }

  return content;
}

export async function clientMarkRevised(opts: {
  userId: string;
  topic: string;
  subject: string | null;
}) {
  const { userId, topic, subject } = opts;

  const { error } = await supabase.functions.invoke("revision-suggest", {
    body: { action: "mark_revised", topic, subject }
  });

  if (error) {
    console.error("revision-suggest mark_revised failed:", error);
    throw new Error(error.message || "Failed to mark topic as revised");
  }
  
  // Clear flashcards/formulas/summary cache if revised to trigger fresh updates on next load
  const modes: ("flashcards" | "viva" | "formulas" | "summary")[] = ["flashcards", "viva", "formulas", "summary"];
  modes.forEach(mode => {
    try {
      localStorage.removeItem(`rev_cache:${userId}:${mode}:${topic.toLowerCase()}`);
    } catch { /* ignore */ }
  });
}
