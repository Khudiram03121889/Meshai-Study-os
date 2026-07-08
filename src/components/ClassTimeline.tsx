import { useEffect, useMemo, useState } from "react";
import { Clock, FileText, ArrowDown, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubjects } from "@/data/syllabus";

interface Session {
  id: string;
  session_date: string;
  subject_id: string;
  chapter_id: string | null;
  title: string | null;
  summary: string | null;
  continuity_context: string | null;
  previous_session_id: string | null;
  lecturer_id: string | null;
  lecturer_name?: string;
  notes_count?: number;
}

const subjectColor: Record<string, string> = {
  physics: "text-[hsl(var(--physics))] border-[hsl(var(--physics))]/40 bg-[hsl(var(--physics))]/5",
  chemistry: "text-[hsl(var(--chemistry))] border-[hsl(var(--chemistry))]/40 bg-[hsl(var(--chemistry))]/5",
  mathematics: "text-[hsl(var(--mathematics))] border-[hsl(var(--mathematics))]/40 bg-[hsl(var(--mathematics))]/5",
};

export default function ClassTimeline() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: sess } = await supabase
        .from("class_sessions")
        .select("*, lecturers(name)")
        .eq("user_id", user.id)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });

      const { data: noteRows } = await supabase
        .from("notes")
        .select("class_session_id")
        .eq("user_id", user.id);

      const counts: Record<string, number> = {};
      (noteRows || []).forEach((n: any) => {
        if (n.class_session_id) counts[n.class_session_id] = (counts[n.class_session_id] || 0) + 1;
      });

      setSessions(
        (sess || []).map((s: any) => ({
          ...s,
          lecturer_name: s.lecturers?.name || null,
          notes_count: counts[s.id] || 0,
        }))
      );
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(
    () => (subjectFilter === "all" ? sessions : sessions.filter((s) => s.subject_id === subjectFilter)),
    [sessions, subjectFilter]
  );

  // group: subject -> lecturer -> sessions (already sorted desc)
  const grouped = useMemo(() => {
    const out: Record<string, Record<string, Session[]>> = {};
    filtered.forEach((s) => {
      const subj = s.subject_id || "other";
      const lect = s.lecturer_name || "Unassigned";
      (out[subj] ||= {});
      (out[subj][lect] ||= []).push(s);
    });
    return out;
  }, [filtered]);

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Clock className="w-7 h-7 text-primary" /> Class Timeline
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every lecture you've uploaded, grouped by lecturer with continuity arrows showing how each chapter unfolded.
          </p>
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </header>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading timeline…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No class sessions yet. Upload notes in <span className="text-foreground font-medium">Daily Notes</span> to start building your timeline.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([subj, byLect]) => {
            const subjectMeta = subjects.find((s) => s.id === subj);
            return (
              <section key={subj} className="space-y-4">
                <h2 className={`text-xl font-display font-bold px-3 py-1.5 rounded-lg inline-block border ${subjectColor[subj] || "border-border bg-card text-foreground"}`}>
                  {subjectMeta?.name || subj}
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(byLect).map(([lect, list]) => (
                    <div key={lect} className="bg-card border border-border rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        {lect}
                      </h3>
                      <ol className="relative space-y-3">
                        {list.map((s, idx) => {
                          const isLast = idx === list.length - 1;
                          return (
                            <li key={s.id} className="relative pl-6">
                              <span className="absolute left-0 top-2 w-2.5 h-2.5 rounded-full bg-primary" />
                              {!isLast && (
                                <span className="absolute left-[3px] top-5 bottom-[-12px] w-0.5 bg-border" />
                              )}
                              <div className="bg-background/50 border border-border rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(s.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                  {s.notes_count ? (
                                    <span className="text-[10px] flex items-center gap-1 text-primary">
                                      <FileText className="w-3 h-3" />{s.notes_count}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm font-medium text-foreground">
                                  {s.title || s.chapter_id || "Untitled session"}
                                </p>
                                {s.summary && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.summary}</p>
                                )}
                                {s.continuity_context && idx < list.length - 1 && (
                                  <div className="mt-2 flex items-start gap-1 text-[11px] text-muted-foreground italic">
                                    <ArrowDown className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                                    <span className="line-clamp-2">{s.continuity_context}</span>
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
