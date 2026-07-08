import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Target, Timer, RotateCcw, XCircle, FastForward, ArrowLeft, ChevronRight } from "lucide-react";
import { useStudyStore } from "@/data/store";
import PreLearnMode from "./study/PreLearnMode";
import LearnMode from "./study/LearnMode";
import PracticeMode from "./study/PracticeMode";
import TestMode from "./study/TestMode";
import MistakeMode from "./study/MistakeMode";

const modes = [
  { id: "prelearn", title: "Pre-Learn Mode", description: "Study topics before your lecturer teaches them", icon: FastForward, gradient: "from-primary to-accent" },
  { id: "learn", title: "Learn Mode", description: "AI explains concepts step-by-step with examples", icon: BookOpen, gradient: "from-primary to-primary/60" },
  { id: "practice", title: "Practice Mode", description: "MCQs based on your covered topics (Boards / NEET / JEE)", icon: Target, gradient: "from-accent to-accent/60" },
  { id: "test", title: "Test Mode", description: "Timed tests that simulate real exam conditions", icon: Timer, gradient: "from-info to-info/60" },
  { id: "mistake", title: "Mistake Practice", description: "Retry and practice only the questions you got wrong", icon: XCircle, gradient: "from-destructive to-destructive/60" },
];

interface StudyModesProps {
  onNavigate?: (page: string) => void;
}

export default function StudyModes({ onNavigate }: StudyModesProps) {
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const { testResults, attempts } = useStudyStore();

  useEffect(() => {
    const defaultMode = localStorage.getItem("active_study_mode");
    if (defaultMode) {
      setActiveMode(defaultMode);
      localStorage.removeItem("active_study_mode");
    }
  }, []);

  // Flow recommendation based on performance
  const getRecommendedMode = () => {
    const wrongCount = attempts.filter((a) => !a.isCorrect).length;
    const totalAttempts = attempts.length;
    if (totalAttempts === 0) return "prelearn";
    if (wrongCount > totalAttempts * 0.3) return "mistake";
    const lastTest = testResults[testResults.length - 1];
    if (lastTest && lastTest.score < 70) return "mistake";
    return "practice";
  };

  const recommended = getRecommendedMode();

  if (activeMode) {
    const ModeComponent: Record<string, React.ComponentType<any>> = {
      prelearn: PreLearnMode,
      learn: LearnMode,
      practice: PracticeMode,
      test: TestMode,
      mistake: MistakeMode,
    };
    const Component = ModeComponent[activeMode];
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button onClick={() => setActiveMode(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Study Modes
        </button>
        {Component ? (
          <Component onNavigate={onNavigate} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">Mode not found.</div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Study Modes</h1>
        <p className="text-muted-foreground text-sm">Choose how you want to study</p>
      </div>

      {/* Flow recommendation */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">💡 Recommended: <span className="text-primary capitalize">{modes.find((m) => m.id === recommended)?.title}</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Based on your performance and study flow</p>
        </div>
        <button onClick={() => setActiveMode(recommended)} className="text-sm text-primary flex items-center gap-1 hover:underline">
          Start <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Flow diagram */}
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground overflow-x-auto py-2">
        {modes.map((m, i) => (
          <span key={m.id} className="flex items-center gap-1 shrink-0">
            <span className={`px-2 py-1 rounded-md ${recommended === m.id ? "bg-primary/10 text-primary" : "bg-secondary"}`}>{m.title.replace(" Mode", "").replace(" Practice", "")}</span>
            {i < modes.length - 1 && <span className="text-border">→</span>}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modes.map((mode, i) => (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => setActiveMode(mode.id)}
            className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors cursor-pointer group"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
              <mode.icon className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-1">{mode.title}</h3>
            <p className="text-muted-foreground text-sm mb-3">{mode.description}</p>
            {recommended === mode.id && (
              <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary">Recommended</span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
