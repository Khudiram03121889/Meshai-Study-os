import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Timer, Loader2, ArrowLeft, ChevronRight, AlertTriangle, ChevronLeft, FileText, Sparkles, BookOpen } from "lucide-react";
import TopicSelector from "./TopicSelector";
import StudyMarkdown from "./StudyMarkdown";
import { useStudyStore, type QuestionAttempt, type TestResult } from "@/data/store";
import { useSubjects } from "@/data/syllabus";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TestQuestion {
  id: number;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  difficulty: string;
  marks: number;
  time_expected: number;
  topic?: string;
  source?: "past_paper" | "pattern" | "syllabus";
  source_ref?: string;
}

interface PaperMeta {
  target: number;
  delivered: number;
  past_paper_count: number;
  pattern_count: number;
  syllabus_count: number;
  past_paper_pool: number;
}

const PAGE_SIZE = 10;

export default function TestMode() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const { addAttempts, addTestResult } = useStudyStore();
  const [selection, setSelection] = useState<any>(null);

  const exam = user ? localStorage.getItem(`user_exam_${user.id}`) : null;
  const examOptions = ["Boards", exam === "neet" ? "NEET" : "JEE"];

  const [examType, setExamType] = useState("Boards");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [meta, setMeta] = useState<PaperMeta | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'config' | 'test' | 'result'>('select');
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [page, setPage] = useState(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const submitRef = useRef<() => void>(() => {});

  const isCompetitive = examType !== "Boards";
  const targetCount = isCompetitive ? 60 : 30;

  useEffect(() => {
    if (step === 'test' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            submitRef.current();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [step]);

  const startTest = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please log in");

      const subject = subjects.find((s) => s.id === selection.subjectId);
      const chapter = subject?.chapters.find((c) => c.id === selection.chapterId);
      const topicHint = chapter?.topics.map((t) => t.name).join(", ") || selection.topicName || "";

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-paper`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: selection.subjectId,
          subjectName: selection.subjectName,
          chapterId: selection.chapterId,
          chapterName: selection.chapterName,
          examType,
          topicHint,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      const qs: TestQuestion[] = data.questions || [];
      if (!qs.length) throw new Error("No questions generated");

      setQuestions(qs);
      setMeta(data.meta || null);
      const time = data.total_time || qs.length * (isCompetitive ? 72 : 60);
      setTotalTime(time);
      setTimeLeft(time);
      setAnswers({});
      setPage(0);
      startTimeRef.current = Date.now();
      setStep('test');
      toast.success(`Generated ${qs.length} questions${data.meta?.past_paper_count ? ` (${data.meta.past_paper_count} from your past papers)` : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate test");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTest = () => {
    clearInterval(timerRef.current);
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    const correct = questions.filter((q) => answers[q.id] === q.correct).length;

    const attempts: QuestionAttempt[] = questions.map((q) => ({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mode: 'test' as const,
      subjectId: selection.subjectId,
      chapterId: selection.chapterId,
      topicId: selection.topicId,
      question: q.question,
      options: q.options,
      correctAnswer: q.correct,
      studentAnswer: answers[q.id] || "",
      isCorrect: answers[q.id] === q.correct,
      explanation: q.explanation,
      examType,
    }));
    addAttempts(attempts);

    addTestResult({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      subjectId: selection.subjectId,
      chapterId: selection.chapterId,
      examType,
      totalQuestions: questions.length,
      correctAnswers: correct,
      score: Math.round((correct / questions.length) * 100),
      timeTaken,
      timeAllowed: totalTime,
      attempts,
    });
    setStep('result');
  };
  submitRef.current = handleSubmitTest;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const score = questions.filter((q) => answers[q.id] === q.correct).length;
  const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

  if (step === 'select') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-info to-info/60 flex items-center justify-center">
            <Timer className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-lg">Test Mode</h2>
            <p className="text-sm text-muted-foreground">Past-paper-driven mock tests with real exam patterns</p>
          </div>
        </div>
        <TopicSelector onSelect={(sel) => { setSelection(sel); setStep('config'); }} title="Select a chapter for the test" />
      </div>
    );
  }

  if (step === 'config') {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep('select')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display font-semibold text-foreground">{selection.chapterName}</h3>
          <p className="text-xs text-muted-foreground">{selection.subjectName}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Exam Type</label>
          <div className="flex gap-2">
            {examOptions.map((e) => (
              <button key={e} onClick={() => setExamType(e)}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                  examType === e ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"
                }`}>{e}</button>
            ))}
          </div>
        </div>
        <div className="bg-info/10 border border-info/20 rounded-xl p-4 space-y-2">
          <p className="text-sm font-display font-semibold text-foreground">
            {targetCount} questions · {isCompetitive ? "Competitive style" : "Boards style"}
          </p>
          <p className="text-xs text-muted-foreground">
            Generated by analysing your uploaded previous-year papers. Relevant past questions are reused; the rest are pattern-matched to real exam style.
          </p>
        </div>
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            <p className="font-medium">Exam Rules</p>
            <p className="text-muted-foreground text-xs mt-1">
              • {targetCount} questions · {isCompetitive ? "72 sec/Q" : "60 sec/Q"} · Timer auto-submits · No hints
            </p>
          </div>
        </div>
        <button onClick={startTest} disabled={loading}
          className="w-full gradient-primary text-primary-foreground font-display font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Building paper from past exams...</> : <>Start Test <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    );
  }

  if (step === 'result') {
    const accuracy = Math.round((score / questions.length) * 100);
    return (
      <div className="space-y-4">
        <button onClick={() => { setStep('select'); setSelection(null); setQuestions([]); setMeta(null); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> New Test
        </button>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-display font-bold text-foreground">{score}/{questions.length}</p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-display font-bold text-foreground">{formatTime(timeTaken)}</p>
            <p className="text-xs text-muted-foreground">Time</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-display font-bold text-foreground">{accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </div>
        </div>
        {meta && (
          <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-primary/10 text-primary inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {meta.past_paper_count} from past papers</span>
            <span className="px-2 py-1 rounded-md bg-info/10 text-info inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> {meta.pattern_count} pattern-matched</span>
            <span className="px-2 py-1 rounded-md bg-secondary text-muted-foreground inline-flex items-center gap-1"><BookOpen className="w-3 h-3" /> {meta.syllabus_count} syllabus</span>
            <span className="px-2 py-1 rounded-md bg-muted/40 text-muted-foreground">Pool: {meta.past_paper_pool}</span>
          </div>
        )}
        {questions.map((q) => (
          <div key={q.id} className={`bg-card border rounded-xl p-4 ${answers[q.id] === q.correct ? "border-primary/30" : "border-destructive/30"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-foreground"><StudyMarkdown content={`${q.id}. ${q.question}`} /></div>
            </div>
            <div className="flex gap-2 mb-2 flex-wrap">
              {q.source === "past_paper" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Past paper{q.source_ref ? ` · ${q.source_ref}` : ""}</span>}
              {q.source === "pattern" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info">Pattern</span>}
              {q.source === "syllabus" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Syllabus</span>}
              {q.topic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{q.topic}</span>}
            </div>
            {answers[q.id] !== q.correct && (
              <p className="text-xs text-destructive">Your: {answers[q.id] || "—"} | Correct: {q.correct}</p>
            )}
            <div className="text-xs text-muted-foreground mt-2"><StudyMarkdown content={q.explanation} /></div>
          </div>
        ))}
      </div>
    );
  }

  // Test step — paginated
  const totalPages = Math.ceil(questions.length / PAGE_SIZE);
  const pageQuestions = questions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const answered = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between sticky top-0 bg-background py-2 z-10 border-b border-border">
        <div className="text-xs text-muted-foreground">
          Page {page + 1}/{totalPages} · <span className="text-foreground font-medium">{answered}/{questions.length}</span> answered
        </div>
        <div className={`px-4 py-2 rounded-xl text-sm font-display font-bold ${timeLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-card border border-border text-foreground"}`}>
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      {pageQuestions.map((q, i) => (
        <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
          className="bg-card border border-border rounded-xl p-4 space-y-3"
        >
          <div className="flex gap-2 flex-wrap">
            {q.source === "past_paper" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Past paper</span>}
            {q.source === "pattern" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info">Pattern</span>}
            {q.source === "syllabus" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Syllabus</span>}
          </div>
          <div className="text-sm font-medium text-foreground"><StudyMarkdown content={`Q${q.id}. ${q.question}`} /></div>
          <div className="grid gap-2">
            {q.options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              return (
                <button key={`${q.id}-${optIdx}`} onClick={() => setAnswers((p) => ({ ...p, [q.id]: letter }))}
                  className={`text-left px-4 py-2.5 rounded-xl text-sm border transition-all ${
                    answers[q.id] === letter ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary/30 border-border text-muted-foreground"
                  }`}><StudyMarkdown content={`${letter}. ${opt}`} /></button>
              );
            })}
          </div>
        </motion.div>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-4 py-2 rounded-xl bg-card border border-border text-sm flex items-center gap-1 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        {page < totalPages - 1 ? (
          <button
            onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="flex-1 px-4 py-2 rounded-xl bg-card border border-border text-sm flex items-center justify-center gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmitTest} className="flex-1 gradient-primary text-primary-foreground font-display font-semibold py-2 rounded-xl">
            Submit Test
          </button>
        )}
      </div>
    </div>
  );
}
