import { useState } from "react";
import { motion } from "framer-motion";
import { XCircle, Loader2, ArrowLeft, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { fetchStudyMode } from "@/lib/studyModeApi";
import { useStudyStore } from "@/data/store";
import { useSubjects } from "@/data/syllabus";
import { toast } from "sonner";

interface MistakeAnalysis {
  question_id: number;
  question: string;
  student_answer: string;
  correct_answer: string;
  mistake_type: string;
  mistake_detail: string;
  correction: string;
  similar_question?: {
    question: string;
    options: string[];
    correct: string;
    explanation: string;
  };
}

const MISTAKE_LABELS: Record<string, { label: string; color: string }> = {
  conceptual: { label: "Conceptual Error", color: "text-destructive" },
  calculation: { label: "Calculation Error", color: "text-warning" },
  sign_error: { label: "Sign Error (±)", color: "text-warning" },
  formula_misuse: { label: "Formula Misuse", color: "text-destructive" },
  careless: { label: "Careless Mistake", color: "text-info" },
};

export default function MistakeMode() {
  const subjects = useSubjects();
  const { getWrongAttempts } = useStudyStore();
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [analysis, setAnalysis] = useState<MistakeAnalysis[]>([]);
  const [pattern, setPattern] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'result'>('select');
  const [similarAnswers, setSimilarAnswers] = useState<Record<number, string>>({});
  const [showSimilarResult, setShowSimilarResult] = useState<Record<number, boolean>>({});

  const wrongAttempts = getWrongAttempts(subjectId || undefined, chapterId || undefined);
  const subject = subjects.find((s) => s.id === subjectId);

  // Get chapters that have wrong attempts
  const chaptersWithMistakes = subject?.chapters.filter((c) =>
    getWrongAttempts(subjectId, c.id).length > 0
  ) ?? [];

  const handleAnalyze = async () => {
    if (wrongAttempts.length === 0) { toast.error("No mistakes to analyze"); return; }
    setLoading(true);
    try {
      const mistakes = wrongAttempts.slice(0, 10).map((a) => ({
        question: a.question,
        student_answer: a.studentAnswer,
        correct_answer: a.correctAnswer,
        formula_used: a.formulaUsed,
      }));

      const parsed = await fetchStudyMode({
        mode: "mistake",
        topic: "",
        chapter: subject?.chapters.find((c) => c.id === chapterId)?.name || "",
        subject: subject?.name || "",
        mistakes,
      });
      const data = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
      setAnalysis(data.analysis || []);
      setPattern(data.pattern || "");
      setRecommendation(data.recommendation || "");
      setStep('result');
    } catch (e: any) {
      toast.error(e.message || "Failed to analyze mistakes");
    } finally {
      setLoading(false);
    }
  };

  if (step === 'select') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive to-destructive/60 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-lg">Mistake Mode</h2>
            <p className="text-sm text-muted-foreground">Analyze and fix all types of errors</p>
          </div>
        </div>

        {/* Subject */}
        <div className="flex gap-2">
          {subjects.map((s) => {
            const count = getWrongAttempts(s.id).length;
            return (
              <button key={s.id} onClick={() => { setSubjectId(s.id); setChapterId(""); }}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                  subjectId === s.id ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"
                }`}
              >
                {s.icon} {s.name}
                {count > 0 && <span className="ml-1 text-xs text-destructive">({count})</span>}
              </button>
            );
          })}
        </div>

        {subjectId && chaptersWithMistakes.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            {chaptersWithMistakes.map((c) => {
              const count = getWrongAttempts(subjectId, c.id).length;
              return (
                <button key={c.id} onClick={() => setChapterId(c.id)}
                  className={`w-full px-4 py-3 rounded-xl text-sm text-left border flex items-center justify-between ${
                    chapterId === c.id ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-destructive">{count} errors</span>
                </button>
              );
            })}
          </motion.div>
        )}

        {subjectId && chaptersWithMistakes.length === 0 && (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
            🎉 No mistakes in this subject! Practice more to generate data.
          </p>
        )}

        {chapterId && wrongAttempts.length > 0 && (
          <button onClick={handleAnalyze} disabled={loading}
            className="w-full gradient-primary text-primary-foreground font-display font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <>Analyze Mistakes <ChevronRight className="w-4 h-4" /></>}
          </button>
        )}
      </div>
    );
  }

  // Result
  return (
    <div className="space-y-4">
      <button onClick={() => { setStep('select'); setAnalysis([]); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {pattern && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Pattern Detected</p>
            <p className="text-xs text-muted-foreground mt-1">{pattern}</p>
          </div>
        </div>
      )}

      {analysis.map((a, i) => {
        const info = MISTAKE_LABELS[a.mistake_type] || { label: a.mistake_type, color: "text-muted-foreground" };
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium px-2 py-1 rounded-md bg-secondary ${info.color}`}>{info.label}</span>
            </div>
            <p className="text-sm text-foreground">{a.question}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-2">
                <p className="text-destructive">Your: {a.student_answer}</p>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                <p className="text-primary">Correct: {a.correct_answer}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">{a.mistake_detail}</p>
            <p className="text-xs text-foreground">{a.correction}</p>

            {/* Similar question */}
            {a.similar_question && (
              <div className="border-t border-border pt-3 mt-3">
                <p className="text-xs font-medium text-foreground mb-2">🔄 Try a similar question:</p>
                <p className="text-sm text-foreground mb-2">{a.similar_question.question}</p>
                <div className="grid gap-1">
                  {a.similar_question.options.map((opt) => {
                    const letter = opt.charAt(0);
                    const answered = showSimilarResult[i];
                    const isCorrect = letter === a.similar_question!.correct;
                    const isSelected = similarAnswers[i] === letter;
                    return (
                      <button key={opt}
                        onClick={() => { if (!answered) setSimilarAnswers((p) => ({ ...p, [i]: letter })); }}
                        className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                          answered && isCorrect ? "bg-primary/10 border-primary/30 text-primary" :
                          answered && isSelected && !isCorrect ? "bg-destructive/10 border-destructive/30 text-destructive" :
                          isSelected ? "bg-primary/10 border-primary/30 text-primary" :
                          "bg-secondary/30 border-border text-muted-foreground"
                        }`}>{opt}</button>
                    );
                  })}
                </div>
                {similarAnswers[i] && !showSimilarResult[i] && (
                  <button onClick={() => setShowSimilarResult((p) => ({ ...p, [i]: true }))}
                    className="mt-2 text-xs text-primary hover:underline">Check Answer</button>
                )}
                {showSimilarResult[i] && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {similarAnswers[i] === a.similar_question.correct
                      ? <><CheckCircle2 className="w-3 h-3 text-primary" /> Correct!</>
                      : <><XCircle className="w-3 h-3 text-destructive" /> {a.similar_question.explanation}</>
                    }
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}

      {recommendation && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
          <p className="text-sm text-foreground">
            💡 Recommended next: <span className="text-primary font-medium capitalize">{recommendation} Mode</span>
          </p>
        </div>
      )}
    </div>
  );
}
