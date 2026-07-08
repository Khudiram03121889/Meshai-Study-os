import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Memory = {
  id: string;
  topic: string;
  subject_id: string | null;
  memory_type: string;
  confidence_score: number | null;
  notes: string | null;
  last_seen: string;
};

type Attempt = {
  id: string;
  subject_id: string;
  topic_id: string;
  is_correct: boolean;
  mistake_type: string | null;
  created_at: string;
};

interface WeakAreasProps {
  onNavigate?: (page: string) => void;
}

export default function WeakAreas({ onNavigate }: WeakAreasProps) {
  const { user } = useAuth();
  const [memory, setMemory] = useState<Memory[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: mem }, { data: att }] = await Promise.all([
        supabase.from("memories").select("*").eq("user_id", user.id).neq("memory_type", "revision").order("created_at", { ascending: false }),
        supabase.from("question_attempts").select("id, subject_id, topic_id, is_correct, mistake_type, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
      ]);

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

      const formattedMem = (mem || []).map((m: any) => ({
        id: m.id,
        topic: getTopic(m),
        notes: getNotes(m),
        confidence_score: m.confidence_score,
        memory_type: m.memory_type,
        subject_id: m.subject_slug,
        last_seen: m.updated_at || m.created_at,
      }));

      setMemory(formattedMem);
      setAttempts((att as any) || []);
      setLoading(false);
    })();
  }, [user]);

  // build per-topic stats from attempts
  const topicStats = new Map<string, { total: number; wrong: number; subject: string }>();
  attempts.forEach((a) => {
    const key = a.topic_id;
    const s = topicStats.get(key) || { total: 0, wrong: 0, subject: a.subject_id };
    s.total += 1;
    if (!a.is_correct) s.wrong += 1;
    topicStats.set(key, s);
  });
  const weakFromAttempts = Array.from(topicStats.entries())
    .filter(([, s]) => s.total >= 2 && s.wrong / s.total >= 0.4)
    .map(([topic, s]) => ({ topic, subject: s.subject, accuracy: Math.round(((s.total - s.wrong) / s.total) * 100), attempts: s.total, wrong: s.wrong }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const lowConfidenceMemory = memory.filter((m) => (m.confidence_score ?? 1) < 0.5);
  const strongMemory = memory.filter((m) => (m.confidence_score ?? 0) >= 0.75);

  const mistakeTypes = attempts.filter((a) => !a.is_correct && a.mistake_type).reduce<Record<string, number>>((acc, a) => {
    acc[a.mistake_type!] = (acc[a.mistake_type!] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-warning" /> Weak Areas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Confusion patterns, repeated mistakes, and low-confidence topics from your practice, tests, and AI tutor sessions.
          </p>
        </div>
        {onNavigate && (
          <button
            onClick={() => {
              localStorage.setItem("active_study_mode", "mistake");
              onNavigate("modes");
            }}
            className="gradient-primary text-primary-foreground font-display font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 text-sm shadow-md"
          >
            <AlertTriangle className="w-4 h-4" /> Practice Mistakes
          </button>
        )}
      </header>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Analyzing your study data…</div>
      ) : (
        <div className="space-y-6">
          {/* Low accuracy from question attempts */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" /> Lowest accuracy topics
            </h2>
            {weakFromAttempts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No clear weak topics yet — practice more in Study Modes to populate this.</p>
            ) : (
              <ul className="space-y-2">
                {weakFromAttempts.slice(0, 10).map((w) => (
                  <li key={w.topic} className="flex items-center justify-between gap-3 p-3 bg-background/50 border border-border rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{w.topic}</p>
                      <p className="text-xs text-muted-foreground capitalize">{w.subject} · {w.attempts} attempts, {w.wrong} wrong</p>
                    </div>
                    <span className={`text-sm font-semibold ${w.accuracy < 40 ? "text-destructive" : "text-warning"}`}>
                      {w.accuracy}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* AI learning memory */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> AI memory — flagged weak areas
            </h2>
            {lowConfidenceMemory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No flagged topics yet. As the AI Tutor notices confusion, items will appear here.</p>
            ) : (
              <ul className="space-y-2">
                {lowConfidenceMemory.slice(0, 12).map((m) => (
                  <li key={m.id} className="p-3 bg-background/50 border border-border rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-foreground">{m.topic}</p>
                      <span className="text-xs text-muted-foreground">{Math.round((m.confidence_score || 0) * 100)}% conf.</span>
                    </div>
                    {m.notes && <p className="text-xs text-muted-foreground mt-1 italic">{m.notes}</p>}
                    <div className="flex gap-1 mt-1.5">
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{m.memory_type}</span>
                      {m.subject_id && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{m.subject_id}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Mistake patterns */}
            <section className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Mistake patterns</h2>
              {Object.keys(mistakeTypes).length === 0 ? (
                <p className="text-xs text-muted-foreground">No tagged mistakes yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {Object.entries(mistakeTypes).sort((a, b) => b[1] - a[1]).map(([type, n]) => (
                    <li key={type} className="flex items-center justify-between text-sm">
                      <span className="text-foreground capitalize">{type.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">× {n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Strengths */}
            <section className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" /> Strong areas
              </h2>
              {strongMemory.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keep practicing — your strengths will surface here.</p>
              ) : (
                <ul className="space-y-1.5">
                  {strongMemory.slice(0, 8).map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate">{m.topic}</span>
                      <span className="text-success text-xs">{Math.round((m.confidence_score || 0) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
