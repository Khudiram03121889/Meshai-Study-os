import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, BarChart3, Zap, Clock } from "lucide-react";
import { useStudyStore } from "@/data/store";
import { useSubjects } from "@/data/syllabus";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CheatSheetModal from "./CheatSheetModal";

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const subjects = useSubjects();
  const { logs, tracks } = useStudyStore();
  const [dbLecturers, setDbLecturers] = useState<any[]>([]);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
  
  const studentName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";
  const classLevel = user ? Number(localStorage.getItem(`user_class_${user.id}`) || "12") : 12;

  // Find pending class check topics
  const todayStr = new Date().toISOString().split("T")[0];
  const [pendingPrompt, setPendingPrompt] = useState<{
    lecturerId: string;
    lecturerName: string;
    chapterId: string;
    chapterName: string;
    topicId: string;
    topicName: string;
    subjectId: string;
  } | null>(null);

  // Fetch dynamic user lecturers
  useEffect(() => {
    if (user) {
      supabase
        .from("lecturers")
        .select("*")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (data) setDbLecturers(data);
        });
    }
  }, [user]);

  // Filter subjects/chapters based on the student's class standard (11th or 12th)
  const filteredSubjects = useMemo(() => subjects.map((s) => ({
    ...s,
    chapters: s.chapters.filter((c) => c.class === classLevel),
  })), [subjects, classLevel]);

  useEffect(() => {
    if (!tracks.length || !dbLecturers.length) return;

    for (const track of tracks) {
      const snoozeKey = `dismiss_log_check_${track.lecturerId}_${track.chapterId}_${todayStr}`;
      if (localStorage.getItem(snoozeKey) === "true") continue;

      const lecturer = dbLecturers.find((l) => l.id === track.lecturerId);
      const subject = filteredSubjects.find((s) =>
        s.chapters.some((c) => c.id === track.chapterId)
      );
      const chapter = subject?.chapters.find((c) => c.id === track.chapterId);
      if (!lecturer || !subject || !chapter) continue;

      const totalInChapter = chapter.topics.length;
      const coveredCount = track.coveredTopicIds.length;

      // Only check active chapters that are started but not 100% completed
      if (coveredCount > 0 && coveredCount < totalInChapter) {
        const nextTopic = chapter.topics.find((t) => !track.coveredTopicIds.includes(t.id));
        if (nextTopic) {
          setPendingPrompt((prev) => {
            if (prev?.topicId === nextTopic.id && prev?.lecturerId === track.lecturerId) {
              return prev;
            }
            return {
              lecturerId: track.lecturerId,
              lecturerName: lecturer.name,
              chapterId: track.chapterId,
              chapterName: chapter.name,
              topicId: nextTopic.id,
              topicName: nextTopic.name,
              subjectId: subject.id,
            };
          });
          break;
        }
      }
    }
  }, [tracks, dbLecturers, filteredSubjects, todayStr]);

  const handleVerifyClass = async (understanding: number) => {
    if (!pendingPrompt) return;
    const { lecturerId, chapterId, topicId, subjectId } = pendingPrompt;

    const log: any = {
      id: crypto.randomUUID(),
      date: todayStr,
      subjectId,
      lecturerId,
      chapterId,
      topicIds: [topicId],
      understanding,
      notes: "Automatically verified via daily class check.",
    };

    useStudyStore.getState().addLog(log);
    setPendingPrompt(null);
    toast.success("Class logged successfully! 🎉");
  };

  const handleSnoozePrompt = () => {
    if (!pendingPrompt) return;
    const { lecturerId, chapterId } = pendingPrompt;
    const snoozeKey = `dismiss_log_check_${lecturerId}_${chapterId}_${todayStr}`;
    localStorage.setItem(snoozeKey, "true");
    setPendingPrompt(null);
    toast.message("Prompt snoozed for today.");
  };

  const today = new Date().toISOString().split("T")[0];
  const todayLogs = logs.filter((l) => l.date === today);
  const totalTopicsCovered = tracks.reduce((acc, t) => acc + t.coveredTopicIds.length, 0);
  const totalTopics = filteredSubjects.reduce((acc, s) => acc + s.chapters.reduce((a, c) => a + c.topics.length, 0), 0);
  const progress = totalTopics > 0 ? Math.round((totalTopicsCovered / totalTopics) * 100) : 0;

  const recentLecturer = todayLogs.length > 0
    ? dbLecturers.find((l) => l.id === todayLogs[todayLogs.length - 1].lecturerId)
    : null;

  const stats = [
    { label: "Topics Covered", value: totalTopicsCovered, icon: BookOpen, color: "text-primary" },
    { label: "Sessions Today", value: todayLogs.length, icon: Clock, color: "text-info" },
    { label: "Overall Progress", value: `${progress}%`, icon: BarChart3, color: "text-accent" },
    { label: "Active Tracks", value: tracks.length, icon: Zap, color: "text-warning" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">
          Hey <span className="text-gradient">{studentName}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          {recentLecturer
            ? `Last update: ${recentLecturer.name}'s class`
            : "Ready to log today's classes?"}
        </p>
      </div>

      {/* Daily Class Check Prompt Card */}
      {pendingPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-primary/10 border border-primary/20 rounded-xl p-5 text-left relative overflow-hidden"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-xl shrink-0">
              📅
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-1.5">
                Daily Class Check
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Has <span className="font-medium text-foreground">{pendingPrompt.lecturerName}</span> covered <span className="font-medium text-foreground">"{pendingPrompt.topicName}"</span> in your <span className="font-medium text-foreground">{pendingPrompt.chapterName}</span> class?
              </p>
              
              <div className="flex gap-2 pt-2.5 flex-wrap">
                <button
                  onClick={() => handleVerifyClass(4)}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Yes, understood it!
                </button>
                <button
                  onClick={() => handleVerifyClass(2)}
                  className="px-3.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground hover:bg-accent/10 text-xs font-semibold transition-colors"
                >
                  Yes, need revision
                </button>
                <button
                  onClick={handleSnoozePrompt}
                  className="px-3.5 py-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
                >
                  Not yet
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Prompt Card */}
      <motion.button
        onClick={() => onNavigate("log")}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full bg-card border border-border rounded-xl p-6 text-left glow-primary animate-pulse-glow"
      >
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-display font-semibold text-foreground text-lg">What did your lecturers teach today?</span>
        </div>
        <p className="text-muted-foreground text-sm">
          Log your class sessions to get AI-powered insights, revision schedules, and practice recommendations.
        </p>
      </motion.button>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
            <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-display font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Browse Syllabus", page: "syllabus", icon: "📚" },
            { label: "Log Class", page: "log", icon: "✏️" },
            { label: "Generate Cheat Sheet", page: "cheatsheet", icon: "⚡" },
            { label: "View Performance", page: "performance", icon: "📊" },
            { label: "AI Tutor Chat", page: "chat", icon: "🤖" },
            { label: "Study Modes", page: "modes", icon: "🧠" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => {
                if (action.page === "cheatsheet") {
                  setIsCheatSheetOpen(true);
                } else {
                  onNavigate(action.page);
                }
              }}
              className="bg-secondary hover:bg-secondary/80 border border-border rounded-xl p-4 text-left transition-colors"
            >
              <span className="text-2xl mb-2 block">{action.icon}</span>
              <span className="text-sm font-medium text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lecturer Tracks */}
      {tracks.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-foreground mb-4">Active Tracks</h2>
          <div className="space-y-3">
            {tracks.slice(-5).reverse().map((track) => {
              const lecturer = dbLecturers.find((l) => l.id === track.lecturerId);
              const subject = filteredSubjects.find((s) =>
                s.chapters.some((c) => c.id === track.chapterId)
              );
              const chapter = subject?.chapters.find((c) => c.id === track.chapterId);
              const totalInChapter = chapter?.topics.length ?? 0;
              const pct = totalInChapter > 0 ? Math.round((track.coveredTopicIds.length / totalInChapter) * 100) : 0;

              return (
                <div key={`${track.lecturerId}-${track.chapterId}`} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{lecturer?.avatar || "👨‍🏫"}</span>
                      <span className="font-medium text-foreground text-sm">{lecturer?.name || track.lecturerId}</span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-muted-foreground text-xs">{chapter?.name}</span>
                    </div>
                    <span className="text-xs font-medium text-primary">{pct}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Cheat Sheet Generator Modal */}
      <CheatSheetModal
        isOpen={isCheatSheetOpen}
        onOpenChange={setIsCheatSheetOpen}
        subjects={filteredSubjects}
      />
    </div>
  );
}
