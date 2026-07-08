import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Award, BookOpen, FileText, Flame, TrendingUp, Users, AlertTriangle, ArrowRight, Activity, CheckCircle, HelpCircle } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onNavigate?: (page: string) => void;
}

interface KPIs {
  notes: number;
  sessions: number;
  tests: number;
  avgScore: number;
}

interface SubjectMastery { subject_id: string; confidence: number; count: number; }
interface TrendPoint { date: string; score: number; subject: string; }
interface LecturerActivity { name: string; sessions: number; }
interface WeakTopic { subject_id: string; topic: string; confidence_score: number; }
interface ActivityEvent { type: "note" | "test_paper" | "test_result"; title: string; subtitle: string; date: string; }

const tooltipStyle = {
  background: "rgba(17, 24, 39, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 12,
  color: "hsl(210, 20%, 98%)",
  fontSize: 12,
  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(8px)",
};

const subjectLabel = (id: string) =>
  ({ physics: "Physics", chemistry: "Chemistry", mathematics: "Mathematics", biology: "Biology" } as Record<string, string>)[id] || id;

export default function Performance({ onNavigate }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({ notes: 0, sessions: 0, tests: 0, avgScore: 0 });
  const [mastery, setMastery] = useState<SubjectMastery[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [lecturerActivity, setLecturerActivity] = useState<LecturerActivity[]>([]);
  const [weak, setWeak] = useState<WeakTopic[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [notesRes, sessionsRes, testsRes, lmRes, lecturersRes, papersRes] = await Promise.all([
        supabase.from("notes").select("id, file_name, created_at, status").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("class_sessions").select("id, lecturer_id, subject_id, session_date").eq("user_id", user.id),
        supabase.from("test_results").select("id, score, date, subject_id, exam_type, created_at").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("memories").select("subject_slug, content, confidence_score, memory_type, metadata").eq("user_id", user.id),
        supabase.from("lecturers").select("id, name").eq("user_id", user.id),
        supabase.from("test_papers").select("id, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      const notes = notesRes.data || [];
      const sessions = sessionsRes.data || [];
      const tests = testsRes.data || [];
      const lm = lmRes.data || [];
      const lecturers = lecturersRes.data || [];
      const papers = papersRes.data || [];

      // KPIs
      const avg = tests.length ? Math.round(tests.reduce((a, t) => a + Number(t.score || 0), 0) / tests.length) : 0;
      setKpis({ notes: notes.length, sessions: sessions.length, tests: tests.length, avgScore: avg });

      // Subject mastery from memories table
      const bySub: Record<string, { sum: number; n: number }> = {};
      lm.forEach((m: any) => {
        if (!m.subject_slug || m.memory_type === "revision") return;
        bySub[m.subject_slug] = bySub[m.subject_slug] || { sum: 0, n: 0 };
        bySub[m.subject_slug].sum += Number(m.confidence_score ?? 0.5);
        bySub[m.subject_slug].n += 1;
      });
      setMastery(
        Object.entries(bySub)
          .map(([subject_id, v]) => ({ subject_id, confidence: v.n ? v.sum / v.n : 0, count: v.n }))
          .sort((a, b) => b.count - a.count),
      );

      // Trend
      setTrend(
        tests.map((t: any) => ({
          date: new Date(t.created_at || t.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
          score: Number(t.score || 0),
          subject: t.subject_id || "—",
        })),
      );

      // Lecturer activity
      const lmap: Record<string, string> = {};
      lecturers.forEach((l: any) => (lmap[l.id] = l.name));
      const byLect: Record<string, number> = {};
      sessions.forEach((s: any) => {
        if (!s.lecturer_id) return;
        byLect[s.lecturer_id] = (byLect[s.lecturer_id] || 0) + 1;
      });
      setLecturerActivity(
        Object.entries(byLect).map(([id, n]) => ({ name: (lmap[id] || "Unknown").split(" ")[0], sessions: n })),
      );

      // Weak topics from memories table
      const getTopic = (m: any) => {
        if (m.metadata?.topic) return m.metadata.topic;
        if (m.content.startsWith("Topic: ")) {
          return m.content.split("\n")[0].replace("Topic: ", "").trim();
        }
        return m.content;
      };

      setWeak(
        lm
          .filter((m: any) => m.memory_type !== "revision" && typeof m.confidence_score === "number" && ["mistake", "weak_area", "confusion", "exam_repeated"].includes(m.memory_type))
          .map((m: any) => ({
            topic: getTopic(m),
            subject_id: m.subject_slug,
            confidence_score: m.confidence_score,
          }))
          .sort((a: any, b: any) => a.confidence_score - b.confidence_score)
          .slice(0, 5),
      );

      // Recent activity feed
      const feed: ActivityEvent[] = [
        ...notes.slice(0, 5).map((n: any) => ({ type: "note" as const, title: n.file_name || "Note", subtitle: n.status || "uploaded", date: n.created_at })),
        ...papers.slice(0, 5).map((p: any) => ({ type: "test_paper" as const, title: p.title || "Exam paper", subtitle: "Uploaded", date: p.created_at })),
        ...tests.slice(-5).reverse().map((t: any) => ({ type: "test_result" as const, title: `${t.exam_type || "Test"} — ${subjectLabel(t.subject_id || "")}`, subtitle: `Scored ${t.score}%`, date: t.created_at })),
      ]
        .filter((e) => e.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
      setActivity(feed);

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const hasAnyData = useMemo(
    () => kpis.notes + kpis.sessions + kpis.tests + mastery.length + activity.length > 0,
    [kpis, mastery, activity],
  );

  // Computed standing header properties
  const standing = useMemo(() => {
    if (!kpis.tests) return { label: "Diagnostics Pending", desc: "Complete tests or log study details to compile your standing", gradient: "from-slate-500/10 to-slate-500/20 border-slate-500/30", color: "text-slate-400" };
    if (kpis.avgScore >= 80) return { label: "Elite Standing", desc: "Showing outstanding mastery across core disciplines. Keep pushing!", gradient: "from-emerald-500/10 to-teal-500/20 border-emerald-500/30", color: "text-emerald-400" };
    if (kpis.avgScore >= 60) return { label: "Steady Progress", desc: "Consolidated understanding. Focus on weak topics to break into elite level", gradient: "from-primary/10 to-indigo-500/20 border-primary/30", color: "text-primary" };
    return { label: "Needs Targeted Review", desc: "Scores showing core vulnerabilities. Prioritize mistake practice and revision cards", gradient: "from-rose-500/10 to-amber-500/20 border-rose-500/30", color: "text-rose-400" };
  }, [kpis]);

  const getProficiencyTag = (confidence: number) => {
    if (confidence >= 0.75) return { label: "Proficient", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    if (confidence >= 0.50) return { label: "Developing", style: "bg-primary/10 text-primary border-primary/20" };
    return { label: "Needs Review", style: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
  };

  const KPI = ({ icon: Icon, label, value, accent, detail }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 6 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="bg-card/40 backdrop-blur-md border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 shadow-lg group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-300" />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent} shadow-sm group-hover:scale-105 transition-transform`}><Icon className="w-4 h-4" /></div>
      </div>
      <p className="text-3xl font-display font-bold text-foreground tracking-tight">{value}</p>
      {detail && <p className="text-xs text-muted-foreground mt-1.5 font-medium">{detail}</p>}
    </motion.div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Redesigned Header with glassmorphism and overall Standing summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 bg-card/40 backdrop-blur-md border border-border rounded-2xl shadow-xl">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight flex items-center gap-2">
            Academic Diagnostics
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            A comprehensive overview of your active memories, cognitive strengths, and customized practice analytics.
          </p>
        </div>
        
        {!loading && hasAnyData && (
          <div className={`px-5 py-4 rounded-xl border flex flex-col gap-1 bg-gradient-to-r ${standing.gradient} max-w-md`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold uppercase tracking-wider ${standing.color}`}>{standing.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">{standing.desc}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="bg-card border border-border rounded-2xl p-5 h-28 animate-pulse" />)}
        </div>
      ) : !hasAnyData ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center space-y-4 max-w-md mx-auto shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Activity className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground">No Diagnostics Loaded</h3>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">Upload textbook files, log recent classes, or participate in mock tests to compile your analytical dashboard.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Enhanced KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI icon={FileText} label="Notes Ingested" value={kpis.notes} accent="bg-primary/10 text-primary" detail="Cognitive files indexed" />
            <KPI icon={BookOpen} label="Class Sessions" value={kpis.sessions} accent="bg-info/10 text-info" detail="Lecture continuous tracking" />
            <KPI icon={Award} label="Tests Taken" value={kpis.tests} accent="bg-warning/10 text-warning" detail="Evaluation events recorded" />
            <KPI icon={TrendingUp} label="Average Score" value={`${kpis.avgScore}%`} accent="bg-success/10 text-success" detail="Mean accuracy on mock tests" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subject Mastery Panel - Left Column 2/3 */}
            {mastery.length > 0 && (
              <div className="bg-card/45 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl lg:col-span-2 space-y-6">
                <div>
                  <h2 className="font-display font-bold text-foreground flex items-center gap-2 text-lg">
                    <Flame className="w-5 h-5 text-warning animate-pulse" /> Subject Domain Mastery
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Estimated competency calculated directly from AI memory traces.</p>
                </div>
                <div className="space-y-5">
                  {mastery.map((m) => {
                    const pct = Math.round(m.confidence * 100);
                    const tag = getProficiencyTag(m.confidence);
                    return (
                      <div key={m.subject_id} className="p-4 bg-background/50 border border-border/40 rounded-xl hover:border-primary/20 transition-colors">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-foreground truncate block">{subjectLabel(m.subject_id)}</span>
                            <span className="text-xs text-muted-foreground block mt-0.5">{m.count} topics actively tracked</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${tag.style}`}>{tag.label}</span>
                            <span className="text-sm font-bold text-foreground">{pct}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                          <div className={`rounded-full h-2.5 transition-all duration-500 ${pct < 40 ? "bg-rose-500" : pct < 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Test score trend Area Chart - Right Column 1/3 */}
            <div className="bg-card/45 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl space-y-5">
              <div>
                <h2 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" /> Score Trajectory
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Timeline of evaluation performance.</p>
              </div>
              {trend.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center border border-dashed border-border rounded-xl">
                  <p className="text-xs text-muted-foreground text-center">No scores recorded.<br/>Simulate tests in Study Modes to start.</p>
                </div>
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "hsl(215, 12%, 52%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "hsl(215, 12%, 52%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="score" stroke="hsl(142, 76%, 36%)" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreGlow)" dot={{ r: 4, strokeWidth: 1.5, stroke: "hsl(220, 18%, 10%)", fill: "hsl(142, 76%, 36%)" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Grid: Actionable Weak Spots & Connected Vertical Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Weak Spots with direct study triggers */}
            <div className="bg-card/45 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-foreground flex items-center gap-2 text-lg">
                    <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" /> Urgent Weak Spots
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Critical memory gaps showing lowest confidence scores.</p>
                </div>
                {weak.length > 0 && (
                  <button onClick={() => onNavigate?.("revision-hub")} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    Revise Queue <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {weak.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-border rounded-xl">
                  <p className="text-xs text-muted-foreground">No severe cognitive weaknesses detected. Excellent job!</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {weak.map((w, i) => (
                    <li key={i} className="flex items-center justify-between gap-4 p-3.5 bg-background/50 border border-border/40 hover:border-destructive/30 rounded-xl transition-all">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{w.topic}</p>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{subjectLabel(w.subject_id)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-lg border border-destructive/20">{Math.round(w.confidence_score * 100)}%</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              localStorage.setItem("active_study_mode", "mistake");
                              onNavigate?.("modes");
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border transition-colors"
                          >
                            Practice
                          </button>
                          <button
                            onClick={() => onNavigate?.("revision-hub")}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                          >
                            Revise
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Redesigned connected vertical timeline activity feed */}
            <div className="bg-card/45 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="font-display font-bold text-foreground text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Active Timeline
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Chronological index of your recent academic interactions.</p>
              </div>

              {activity.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-border rounded-xl">
                  <p className="text-xs text-muted-foreground">Timeline is quiet. Start logging classes to fill this index.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-border/60">
                  {activity.map((a, i) => {
                    const isNote = a.type === "note";
                    const isPaper = a.type === "test_paper";
                    
                    const markerColor = isNote 
                      ? "bg-primary ring-primary/20" 
                      : isPaper 
                        ? "bg-info ring-info/20" 
                        : "bg-success ring-success/20";
                    
                    return (
                      <div key={i} className="relative group flex items-start gap-4">
                        {/* Connected dot marker */}
                        <div className={`absolute -left-6 top-1.5 w-2 h-2 rounded-full ${markerColor} ring-4 transition-transform duration-300 group-hover:scale-125 z-10`} />
                        
                        <div className="flex-1 bg-background/50 border border-border/40 rounded-xl p-3.5 hover:border-primary/20 transition-colors">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-muted-foreground">{new Date(a.date).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/60">{a.type.replace("_", " ")}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground mt-1.5 line-clamp-1">{a.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{a.subtitle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
