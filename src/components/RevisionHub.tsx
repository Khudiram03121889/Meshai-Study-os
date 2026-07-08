import { useCallback, useEffect, useState, useRef } from "react";
import { RefreshCw, Sparkles, Loader2, CheckCircle2, BookOpen, Mic, Calculator, Volume2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { supabase } from "@/integrations/supabase/client";
import { preprocessMarkdown } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { clientGenerateRevision, clientMarkRevised } from "@/lib/client-revision-suggest";

type QueueItem = {
  topic: string; subject_id: string | null; memory_type: string;
  confidence: number; days_since_revision: number; revision_count: number;
  priority: number; note: string | null;
};

type Mode = "flashcards" | "viva" | "formulas" | "summary";

export default function RevisionHub() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("flashcards");
  const [content, setContent] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const loadQueue = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: mems } = await supabase.from("memories")
        .select("id, memory_type, content, confidence_score, subject_slug, metadata, updated_at, created_at")
        .eq("user_id", user.id);

      const getTopic = (m: any) => {
        if (m.metadata?.topic) return m.metadata.topic;
        if (m.content.startsWith("Revision needed for: ")) {
          return m.content.split(". Confidence:")[0].replace("Revision needed for: ", "").trim();
        }
        if (m.content.startsWith("Topic: ")) {
          return m.content.split("\n")[0].replace("Topic: ", "").trim();
        }
        return m.content;
      };

      const revs = (mems || []).filter((m: any) => m.memory_type === "revision");
      const mistakes = (mems || []).filter((m: any) => ["mistake", "weak_area", "confusion", "exam_repeated"].includes(m.memory_type));

      const revByTopic = new Map(revs.map((r: any) => [getTopic(r).toLowerCase(), r]));
      
      const now = Date.now();
      const queueItems = [...revs];
      for (const m of mistakes) {
        const topic = getTopic(m);
        if (!revByTopic.has(topic.toLowerCase())) {
          queueItems.push(m);
        }
      }

      const calculatedQueue = queueItems.map((m: any) => {
        const topic = getTopic(m);
        const isRevision = m.memory_type === "revision";
        const lastRev = isRevision 
          ? (m.metadata?.last_revised ? new Date(m.metadata.last_revised).getTime() : new Date(m.updated_at || m.created_at).getTime())
          : new Date(m.updated_at || m.created_at).getTime();
        
        const daysSince = Math.max(1, Math.round((now - lastRev) / 86400000));
        const conf = m.confidence_score ?? 0.5;
        const revCount = isRevision ? (m.metadata?.revision_count || 0) : 0;
        
        const priority = (1 - conf) * 60 + Math.min(daysSince, 30) * 2 + (m.memory_type === "mistake" ? 25 : 0);
        
        return {
          topic,
          subject_id: m.subject_slug,
          memory_type: m.memory_type,
          confidence: Math.round(conf * 100),
          days_since_revision: daysSince,
          revision_count: revCount,
          priority: Math.round(priority),
          note: m.content,
        };
      }).sort((a, b) => b.priority - a.priority).slice(0, 20);

      setQueue(calculatedQueue);
    } catch (err: any) {
      toast.error("Could not load revision queue");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const generate = async (topic: string, subject: string | null, m: Mode) => {
    if (!user) return;
    setActiveTopic(topic);
    setMode(m);
    setContent(null);
    setGenerating(true);
    
    try {
      const resContent = await clientGenerateRevision({
        userId: user.id,
        topic,
        subject,
        action: m,
      });
      setContent(resContent);
    } catch (error: any) {
      toast.error("Generation failed: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const markRevised = async (topic: string, subject: string | null) => {
    if (!user) return;
    try {
      await clientMarkRevised({ userId: user.id, topic, subject });
      toast.success("Marked as revised — confidence bumped");
      loadQueue();
    } catch (err) {
      toast.error("Failed to mark revised");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <RefreshCw className="w-7 h-7 text-primary" /> Revision Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Daily revision queue based on your weak areas and how long it's been since you reviewed each topic.
        </p>
      </header>

      <div className="grid lg:grid-cols-[360px,1fr] gap-6">
        {/* Queue */}
        <aside className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Today's queue</h2>
            <button onClick={loadQueue} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
          ) : queue.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl">
              Nothing to revise yet — practice or chat with the AI Tutor to seed your memory.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {queue.map((q) => (
                <li
                  key={q.topic}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${activeTopic === q.topic ? "bg-primary/10 border-primary/40" : "bg-card border-border hover:border-primary/30"}`}
                  onClick={() => generate(q.topic, q.subject_id, mode)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{q.topic}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${q.confidence < 40 ? "bg-destructive/15 text-destructive" : q.confidence < 70 ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                      {q.confidence}%
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {q.subject_id && <span className="capitalize">{q.subject_id}</span>}
                    <span>· {q.days_since_revision}d ago</span>
                    <span>· revised × {q.revision_count}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Content area */}
        <section className="bg-card border border-border rounded-xl p-5 min-h-[400px]">
          {!activeTopic ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-16">
              <Sparkles className="w-10 h-10 mb-3 text-primary/50" />
              <p className="text-sm">Pick a topic from the queue to start revising.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">{activeTopic}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{mode}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <ModeBtn current={mode} value="flashcards" icon={<BookOpen className="w-3.5 h-3.5" />} label="Flashcards" onClick={() => generate(activeTopic, queue.find((q) => q.topic === activeTopic)?.subject_id || null, "flashcards")} />
                  <ModeBtn current={mode} value="viva" icon={<Mic className="w-3.5 h-3.5" />} label="Viva" onClick={() => generate(activeTopic, queue.find((q) => q.topic === activeTopic)?.subject_id || null, "viva")} />
                  <ModeBtn current={mode} value="formulas" icon={<Calculator className="w-3.5 h-3.5" />} label="Formulas" onClick={() => generate(activeTopic, queue.find((q) => q.topic === activeTopic)?.subject_id || null, "formulas")} />
                  <ModeBtn current={mode} value="summary" icon={<Volume2 className="w-3.5 h-3.5" />} label="Audio Brief" onClick={() => generate(activeTopic, queue.find((q) => q.topic === activeTopic)?.subject_id || null, "summary")} />
                  <button
                    onClick={() => markRevised(activeTopic, queue.find((q) => q.topic === activeTopic)?.subject_id || null)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs hover:bg-success/25"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark revised
                  </button>
                </div>
              </div>

              {generating ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating…
                </div>
              ) : content ? (
                <RevisionContent mode={mode} content={content} />
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ModeBtn({ current, value, icon, label, onClick }: { current: Mode; value: Mode; icon: React.ReactNode; label: string; onClick: () => void }) {
  const active = current === value;
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-background border border-border text-foreground hover:bg-secondary"}`}>
      {icon} {label}
    </button>
  );
}

function AudioWaveform({ isPlaying }: { isPlaying: boolean }) {
  const [heights, setHeights] = useState([16, 24, 12, 32, 20, 16, 28, 14, 20, 16]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setHeights(prev => prev.map(() => Math.floor(Math.random() * 28) + 6));
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="flex items-center gap-1.5 h-12 justify-center">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-primary transition-all duration-100"
          style={{ height: isPlaying ? `${h}px` : "8px" }}
        />
      ))}
    </div>
  );
}

function AudioSummaryPlayer({ script }: { script: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleTogglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(script);
      
      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Premium"))
      ) || voices.find((v) => v.lang.startsWith("en"));
      
      if (naturalVoice) u.voice = naturalVoice;

      u.onend = () => {
        setIsPlaying(false);
      };
      u.onerror = () => {
        setIsPlaying(false);
      };
      
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-background/40 border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden">
      <AudioWaveform isPlaying={isPlaying} />

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">NCERT Audio Brief Summary</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Listen to a quick spoken narration of this topic's key concepts.
        </p>
      </div>

      <button
        onClick={handleTogglePlay}
        className={`px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 font-display font-semibold text-xs transition-all active:scale-[0.98] ${
          isPlaying
            ? "bg-destructive text-destructive-foreground hover:opacity-90"
            : "gradient-primary text-primary-foreground hover:opacity-95"
        }`}
      >
        {isPlaying ? (
          <>
            <Square className="w-3.5 h-3.5 fill-current" /> Stop Listening
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-current" /> Listen Now
          </>
        )}
      </button>

      {/* Narrative script printout */}
      <div className="w-full border-t border-border pt-4 text-left">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Narrator Script</span>
        <p className="text-xs leading-relaxed text-muted-foreground/80 whitespace-pre-wrap bg-background/50 border border-border/40 p-3 rounded-lg max-h-48 overflow-y-auto">
          {script}
        </p>
      </div>
    </div>
  );
}

function RevisionContent({ mode, content }: { mode: Mode; content: any }) {
  const proseClasses = "prose prose-sm prose-invert max-w-none [&_p]:my-1";
  
  if (mode === "summary") {
    return <AudioSummaryPlayer script={content.script || ""} />;
  }

  if (mode === "flashcards") {
    return (
      <div className="space-y-3">
        {(content.cards || []).map((c: any, i: number) => (
          <details key={i} className="bg-background/40 border border-border rounded-lg p-3 group">
            <summary className="cursor-pointer text-sm text-foreground font-medium">Q{i + 1}. {c.q}</summary>
            <div className={`mt-2 text-sm text-muted-foreground ${proseClasses}`}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessMarkdown(c.a)}</ReactMarkdown>
            </div>
          </details>
        ))}
      </div>
    );
  }
  if (mode === "viva") {
    return (
      <ol className="space-y-3 list-decimal list-inside">
        {(content.questions || []).map((q: any, i: number) => (
          <li key={i} className="bg-background/40 border border-border rounded-lg p-3 text-sm">
            <p className="text-foreground font-medium">{q.q}</p>
            <div className={`mt-1 text-muted-foreground ${proseClasses}`}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessMarkdown(q.a)}</ReactMarkdown>
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ul className="space-y-2">
      {(content.formulas || []).map((f: any, i: number) => (
        <li key={i} className="bg-background/40 border border-border rounded-lg p-3 text-sm">
          <p className="text-foreground font-medium">{f.name}</p>
          <div className={proseClasses}>
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessMarkdown(f.formula)}</ReactMarkdown>
          </div>
          {f.when && <p className="text-xs text-muted-foreground mt-1 italic">When: {f.when}</p>}
        </li>
      ))}
    </ul>
  );
}
