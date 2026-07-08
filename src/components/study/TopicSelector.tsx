import { useState } from "react";
import { motion } from "framer-motion";
import { useSubjects } from "@/data/syllabus";
import { useStudyStore } from "@/data/store";
import { ChevronRight } from "lucide-react";

interface TopicSelectorProps {
  onSelect: (selection: {
    subjectId: string;
    subjectName: string;
    chapterId: string;
    chapterName: string;
    topicId: string;
    topicName: string;
    lecturerId?: string;
    lecturerName?: string;
  }) => void;
  showLecturer?: boolean;
  filterStarted?: boolean;
  title?: string;
}

export default function TopicSelector({ onSelect, showLecturer, filterStarted, title }: TopicSelectorProps) {
  const { tracks } = useStudyStore();
  const subjects = useSubjects();
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");

  const subject = subjects.find((s) => s.id === subjectId);

  const filteredChapters = subject?.chapters.filter((c) => {
    if (!filterStarted) return true;
    return tracks.some((t) => t.chapterId === c.id && t.coveredTopicIds.length > 0);
  }) ?? [];

  const chapter = subject?.chapters.find((c) => c.id === chapterId);

  return (
    <div className="space-y-4">
      {title && <p className="text-sm text-muted-foreground">{title}</p>}

      {/* Subject */}
      <div className="flex gap-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSubjectId(s.id); setChapterId(""); }}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
              subjectId === s.id ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      {/* Chapters */}
      {subjectId && filteredChapters.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2 max-h-48 overflow-y-auto pr-1">
          {filteredChapters.map((c) => {
            const track = tracks.find((t) => t.chapterId === c.id);
            const pct = track ? Math.round((track.coveredTopicIds.length / c.topics.length) * 100) : 0;
            return (
              <button
                key={c.id}
                onClick={() => setChapterId(c.id)}
                className={`px-4 py-3 rounded-xl text-sm text-left border flex items-center justify-between ${
                  chapterId === c.id ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"
                }`}
              >
                <span>{c.name}</span>
                {pct > 0 && <span className="text-xs text-primary">{pct}%</span>}
              </button>
            );
          })}
        </motion.div>
      )}

      {subjectId && filterStarted && filteredChapters.length === 0 && (
        <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">No chapters started yet. Log a class session first.</p>
      )}

      {/* Topics */}
      {chapter && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2 max-h-48 overflow-y-auto pr-1">
          {chapter.topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() =>
                onSelect({
                  subjectId,
                  subjectName: subject!.name,
                  chapterId: chapter.id,
                  chapterName: chapter.name,
                  topicId: topic.id,
                  topicName: topic.name,
                })
              }
              className="px-4 py-3 rounded-xl text-sm text-left border bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all flex items-center justify-between group"
            >
              <span>{topic.name}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
