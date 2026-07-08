import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Loader2, ArrowLeft, Eye, EyeOff, ChevronRight, ChevronLeft } from "lucide-react";
import TopicSelector from "./TopicSelector";
import { fetchStudyMode } from "@/lib/studyModeApi";
import { useStudyStore } from "@/data/store";
import { toast } from "sonner";

interface Flashcard { id: number; front: string; back: string; category: string; }
interface QuickQ { id: number; question: string; answer: string; time_limit: number; }
interface FormulaRecall { formula: string; topic: string; hint: string; }

export default function RevisionMode() {
  const { tracks, logs } = useStudyStore();
  const [selection, setSelection] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quickQuestions, setQuickQuestions] = useState<QuickQ[]>([]);
  const [formulaRecall, setFormulaRecall] = useState<FormulaRecall[]>([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [tab, setTab] = useState<'flashcards' | 'quick' | 'formulas'>('flashcards');
  const [showAnswer, setShowAnswer] = useState<Record<number, boolean>>({});

  const handleSelect = async (sel: any) => {
    setSelection(sel);
    setLoading(true);
    try {
      const lastLog = logs.filter((l) => l.chapterId === sel.chapterId).sort((a, b) => b.date.localeCompare(a.date))[0];
      const parsed = await fetchStudyMode({
        mode: "revision",
        topic: sel.topicName,
        chapter: sel.chapterName,
        subject: sel.subjectName,
        context: lastLog ? `Last studied: ${lastLog.date}` : undefined,
      });
      const data = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
      setFlashcards(data.flashcards || []);
      setQuickQuestions(data.quick_questions || []);
      setFormulaRecall(data.formula_recall || []);
      setCurrentCard(0);
      setShowBack(false);
      setShowAnswer({});
    } catch (e: any) {
      toast.error(e.message || "Failed to generate revision material");
    } finally {
      setLoading(false);
    }
  };

  if (!selection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warning to-warning/60 flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-lg">Revision Mode</h2>
            <p className="text-sm text-muted-foreground">Flashcards, formula recall & quick questions</p>
          </div>
        </div>
        <TopicSelector onSelect={handleSelect} filterStarted title="Select a topic you've studied" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-16 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Generating revision material...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => { setSelection(null); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Tabs */}
      <div className="flex gap-2">
        {([['flashcards', '🃏 Flashcards'], ['quick', '⚡ Quick Q'], ['formulas', '📐 Formulas']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
              tab === key ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"
            }`}>{label}</button>
        ))}
      </div>

      {/* Flashcards */}
      {tab === 'flashcards' && flashcards.length > 0 && (
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div key={currentCard} initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: -90 }}
              onClick={() => setShowBack(!showBack)}
              className="bg-card border border-border rounded-xl p-8 min-h-[200px] flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors"
            >
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-3">{showBack ? "Answer" : "Question"} • {currentCard + 1}/{flashcards.length}</p>
                <p className="text-foreground font-medium">{showBack ? flashcards[currentCard].back : flashcards[currentCard].front}</p>
                <p className="text-xs text-muted-foreground mt-4">Tap to flip</p>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex gap-2 justify-center">
            <button onClick={() => { setCurrentCard((c) => Math.max(0, c - 1)); setShowBack(false); }}
              disabled={currentCard === 0} className="px-4 py-2 rounded-xl bg-card border border-border text-sm disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => { setCurrentCard((c) => Math.min(flashcards.length - 1, c + 1)); setShowBack(false); }}
              disabled={currentCard === flashcards.length - 1} className="px-4 py-2 rounded-xl bg-card border border-border text-sm disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Questions */}
      {tab === 'quick' && quickQuestions.length > 0 && (
        <div className="space-y-3">
          {quickQuestions.map((q) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-foreground mb-2">{q.question}</p>
              <button onClick={() => setShowAnswer((p) => ({ ...p, [q.id]: !p[q.id] }))}
                className="flex items-center gap-2 text-xs text-primary hover:underline"
              >
                {showAnswer[q.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showAnswer[q.id] ? "Hide" : "Show"} Answer
              </button>
              {showAnswer[q.id] && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground mt-2 bg-secondary/50 rounded-lg p-3">
                  {q.answer}
                </motion.p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formula Recall */}
      {tab === 'formulas' && formulaRecall.length > 0 && (
        <div className="space-y-3">
          {formulaRecall.map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{f.topic}</p>
              <p className="text-foreground font-mono text-sm font-medium">{f.formula}</p>
              <p className="text-xs text-muted-foreground mt-1">💡 {f.hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
