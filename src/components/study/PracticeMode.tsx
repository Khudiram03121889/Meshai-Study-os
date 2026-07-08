import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Loader2, ArrowLeft, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import TopicSelector from "./TopicSelector";
import StudyMarkdown from "./StudyMarkdown";
import { fetchStudyMode } from "@/lib/studyModeApi";
import { useStudyStore, type QuestionAttempt } from "@/data/store";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Question {
  id: number;
  type: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  difficulty: string;
  formula_used?: string;
  common_mistakes?: string[];
}

export default function PracticeMode({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { user } = useAuth();
  const { addAttempts } = useStudyStore();
  const [selection, setSelection] = useState<any>(null);

  const exam = user ? localStorage.getItem(`user_exam_${user.id}`) : null;
  const examOptions = ["Boards", exam === "neet" ? "NEET" : "JEE"];

  const [examType, setExamType] = useState("Boards");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'exam' | 'quiz' | 'result'>('select');

  const handleSelect = (sel: any) => {
    setSelection(sel);
    setStep('exam');
  };

  const startPractice = async () => {
    setLoading(true);
    try {
      const parsed = await fetchStudyMode({
        mode: "practice",
        topic: selection.topicName,
        chapter: selection.chapterName,
        subject: selection.subjectName,
        examType,
      });

      const data = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
      setQuestions(data.questions || []);
      setAnswers({});
      setSubmitted(false);
      setStep('quiz');
    } catch (e: any) {
      toast.error(e.message || "Failed to generate questions");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error("Answer all questions first");
      return;
    }

    const attempts: QuestionAttempt[] = questions.map((q) => ({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mode: 'practice' as const,
      subjectId: selection.subjectId,
      chapterId: selection.chapterId,
      topicId: selection.topicId,
      question: q.question,
      options: q.options,
      correctAnswer: q.correct,
      studentAnswer: answers[q.id] || "",
      isCorrect: answers[q.id] === q.correct,
      explanation: q.explanation,
      formulaUsed: q.formula_used,
      examType,
    }));

    addAttempts(attempts);
    setSubmitted(true);
    setStep('result');
  };

  const score = questions.filter((q) => answers[q.id] === q.correct).length;
  const wrongQuestions = questions.filter((q) => answers[q.id] !== q.correct);

  if (step === 'select') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center">
            <Target className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-lg">Practice Mode</h2>
            <p className="text-sm text-muted-foreground">MCQs based on exam type — Boards or {exam === "neet" ? "NEET" : "JEE"}</p>
          </div>
        </div>
        <TopicSelector onSelect={handleSelect} title="Select topic to practice" />
      </div>
    );
  }

  if (step === 'exam') {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep('select')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display font-semibold text-foreground mb-1">{selection.topicName}</h3>
          <p className="text-xs text-muted-foreground">{selection.chapterName}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Exam Type</label>
          <div className="flex gap-2">
            {examOptions.map((e) => (
              <button key={e} onClick={() => setExamType(e)}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                  examType === e ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"
                }`}
              >{e}</button>
            ))}
          </div>
        </div>
        <button onClick={startPractice} disabled={loading}
          className="w-full gradient-primary text-primary-foreground font-display font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <>Start Practice <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    );
  }

  if (step === 'result') {
    return (
      <div className="space-y-4">
        <button onClick={() => { setStep('select'); setSelection(null); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> New Practice
        </button>

        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <h3 className="font-display font-bold text-2xl text-foreground">{score}/{questions.length}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {score === questions.length ? "🎉 Perfect!" : score >= questions.length * 0.7 ? "👍 Good job!" : "📚 Keep practicing!"}
          </p>
        </div>

        {wrongQuestions.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
            <p className="text-sm font-medium text-foreground mb-2">Weak Areas Detected:</p>
            {wrongQuestions.map((q) => (
              <div key={q.id} className="text-sm text-muted-foreground mb-2">
                <p>❌ {q.question}</p>
                <p className="text-xs mt-1">Your answer: {answers[q.id]} | Correct: {q.correct}</p>
                {q.common_mistakes && <p className="text-xs text-destructive mt-1">⚠️ {q.common_mistakes[0]}</p>}
              </div>
            ))}
          </div>
        )}

        {questions.map((q) => (
          <div key={q.id} className={`bg-card border rounded-xl p-4 ${answers[q.id] === q.correct ? "border-primary/30" : "border-destructive/30"}`}>
            <div className="flex items-start gap-2 mb-2">
              {answers[q.id] === q.correct ? <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> : <XCircle className="w-4 h-4 text-destructive mt-0.5" />}
              <div className="text-sm text-foreground"><StudyMarkdown content={q.question} /></div>
            </div>
            <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3 mt-2"><StudyMarkdown content={q.explanation} /></div>
            {q.formula_used && <div className="text-xs text-primary mt-1"><StudyMarkdown content={`📐 Formula: ${q.formula_used}`} /></div>}
          </div>
        ))}

        {wrongQuestions.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            💡 Recommended: Go to <span className="text-primary cursor-pointer" onClick={() => onNavigate?.("modes")}>Mistake Mode</span> to fix errors
          </p>
        )}
      </div>
    );
  }

  // Quiz step
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setStep('select')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <span className="text-sm text-muted-foreground">{examType} • {Object.keys(answers).length}/{questions.length} answered</span>
      </div>

      {questions.map((q, i) => (
        <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="bg-card border border-border rounded-xl p-4 space-y-3"
        >
          <div className="text-sm font-medium text-foreground"><StudyMarkdown content={`Q${q.id}. ${q.question}`} /></div>
          <div className="grid gap-2">
            {q.options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
              return (
                <button key={`${q.id}-${optIdx}`} onClick={() => setAnswers((p) => ({ ...p, [q.id]: letter }))}
                  className={`text-left px-4 py-2.5 rounded-xl text-sm border transition-all ${
                    answers[q.id] === letter ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                  }`}
                ><StudyMarkdown content={opt} /></button>
              );
            })}
          </div>
        </motion.div>
      ))}

      <button onClick={handleSubmit} className="w-full gradient-primary text-primary-foreground font-display font-semibold py-3 rounded-xl">
        Submit Answers
      </button>
    </div>
  );
}
