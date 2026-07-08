import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useSubjects, getUserBoardLabel, type Chapter, type Topic } from "@/data/syllabus";
import { useStudyStore } from "@/data/store";
import { useAuth } from "@/contexts/AuthContext";

function TopicBadge({ topic, covered }: { topic: Topic; covered: boolean }) {
  const weightageColors = {
    high: "bg-primary/15 text-primary border-primary/30",
    medium: "bg-warning/15 text-warning border-warning/30",
    low: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${covered ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {covered && <span className="text-primary text-xs">✓</span>}
          <span className="text-sm text-foreground">{topic.name}</span>
        </div>
        <div className="flex gap-2 mt-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${weightageColors[topic.examWeightage]}`}>
            Exam Weight: {topic.examWeightage}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            {topic.questionType}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            L{topic.difficulty}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChapterSection({ chapter, coveredTopicIds }: { chapter: Chapter; coveredTopicIds: string[] }) {
  const [open, setOpen] = useState(false);
  const covered = chapter.topics.filter((t) => coveredTopicIds.includes(t.id)).length;
  const pct = Math.round((covered / chapter.topics.length) * 100);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 bg-card hover:bg-secondary/50 transition-colors">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <div className="text-left">
            <span className="text-sm font-medium text-foreground">{chapter.name}</span>
            <span className="text-xs text-muted-foreground ml-2">Class {chapter.class}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{covered}/{chapter.topics.length}</span>
          <div className="w-16 bg-secondary rounded-full h-1.5">
            <div className="bg-primary rounded-full h-1.5" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>
      {open && (
        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="p-4 pt-0 space-y-2">
          {chapter.topics.map((topic) => (
            <TopicBadge key={topic.id} topic={topic} covered={coveredTopicIds.includes(topic.id)} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

export default function SyllabusBrowser() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [activeSubject, setActiveSubject] = useState(subjects[0]?.id || "physics");
  const { tracks } = useStudyStore();
  
  const classLevel = user ? Number(localStorage.getItem(`user_class_${user.id}`) || "12") : 12;
  
  // Make sure activeSubject remains valid if subjects list changes
  const activeSubId = subjects.some(s => s.id === activeSubject) ? activeSubject : (subjects[0]?.id || "physics");
  const subject = subjects.find((s) => s.id === activeSubId) || subjects[0] || { chapters: [] };
  const filteredChapters = (subject.chapters || []).filter((c) => c.class === classLevel);

  const allCoveredIds = tracks.flatMap((t) => t.coveredTopicIds);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Syllabus</h1>
        <p className="text-muted-foreground text-sm">{getUserBoardLabel(user?.id, classLevel)}</p>
      </div>

      {/* Subject tabs */}
      <div className="flex gap-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSubject(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubject === s.id
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      {/* Chapters */}
      <div className="space-y-3">
        {filteredChapters.map((chapter) => (
          <ChapterSection key={chapter.id} chapter={chapter} coveredTopicIds={allCoveredIds} />
        ))}
      </div>
    </div>
  );
}
