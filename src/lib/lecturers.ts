import { supabase } from "@/integrations/supabase/client";

// ponytail: no more static seeding — only returns what user registered

let cache: any[] | null = null;
let cacheUserId: string | null = null;

export async function getUserLecturers(userId: string): Promise<any[]> {
  if (cache && cacheUserId === userId) return cache;
  const { data } = await supabase.from("lecturers").select("id, name, subject_id").eq("user_id", userId);
  cache = data || [];
  cacheUserId = userId;
  return cache;
}

export function resetLecturerCache() {
  cache = null;
  cacheUserId = null;
}
