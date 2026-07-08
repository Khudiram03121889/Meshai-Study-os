import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Loader2, ArrowLeft, Download } from "lucide-react";
import TopicSelector from "./TopicSelector";
import StudyMarkdown from "./StudyMarkdown";
import StudyDocHistory, { StudyDoc } from "./StudyDocHistory";
import StudyDocViewer from "./StudyDocViewer";
import { streamStudyMode } from "@/lib/studyModeApi";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function LearnMode() {
  const { user } = useAuth();
  const [selection, setSelection] = useState<any>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openDoc, setOpenDoc] = useState<StudyDoc | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const saveDoc = async (finalContent: string, sel: any) => {
    if (!user || !finalContent.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("study_documents").insert({
      user_id: user.id,
      mode: "learn",
      topic_name: sel.topicName,
      chapter_name: sel.chapterName,
      subject_name: sel.subjectName,
      subject_id: sel.subjectId ?? null,
      chapter_id: sel.chapterId ?? null,
      topic_id: sel.topicId ?? null,
      content: finalContent,
    });
    setSaving(false);
    if (error) toast.error("Failed to save to history");
    else { toast.success("Saved to history"); setRefreshKey((k) => k + 1); }
  };

  const handleSelect = async (sel: any) => {
    setSelection(sel);
    setContent("");
    setLoading(true);
    let accumulated = "";
    try {
      await streamStudyMode({
        mode: "learn",
        topic: sel.topicName,
        chapter: sel.chapterName,
        subject: sel.subjectName,
        onDelta: (chunk) => { accumulated += chunk; setContent(accumulated); },
        onDone: () => { setLoading(false); saveDoc(accumulated, sel); },
      });
    } catch (e: any) {
      setLoading(false);
      toast.error(e.message || "Failed to generate content");
    }
  };

  const doPrint = (topicName: string, chapterName: string, subjectName: string) => {
    const printEl = document.getElementById("learn-print-area");
    if (!printEl) return;
    const container = document.createElement("div");
    container.id = "print-container";
    container.className = "prose prose-sm max-w-none text-black p-8 bg-white md:p-12";
    container.innerHTML = `
      <div style="margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 12px; font-family: 'Space Grotesk', sans-serif;">
        <h1 style="font-size: 26px; font-weight: bold; margin: 0; color: black;">${topicName}</h1>
        <p style="font-size: 14px; color: #555; margin: 6px 0 0 0; font-weight: 500;">
          Chapter: ${chapterName} &nbsp;•&nbsp; Subject: ${subjectName}
        </p>
      </div>
      <div style="font-family: 'Inter', sans-serif; color: black;">
        ${printEl.innerHTML.replace(/\bprose-invert\b/g, "")}
      </div>`;
    document.body.appendChild(container);
    const originalTitle = document.title;
    document.title = `${topicName.replace(/[^a-zA-Z0-9]/g, "_")}_Notes`;
    document.body.classList.add("printing-learn-content");
    window.print();
    document.title = originalTitle;
    document.body.classList.remove("printing-learn-content");
    document.body.removeChild(container);
  };

  if (openDoc) {
    return (
      <StudyDocViewer
        doc={openDoc}
        onBack={() => setOpenDoc(null)}
        onExportPDF={() => doPrint(openDoc.topic_name, openDoc.chapter_name || "", openDoc.subject_name || "")}
      />
    );
  }

  if (!selection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-lg">Learn Mode</h2>
            <p className="text-sm text-muted-foreground">Deep understanding with detailed explanations</p>
          </div>
        </div>
        <TopicSelector onSelect={handleSelect} title="Select a topic to learn in depth" />
        <StudyDocHistory mode="learn" onOpen={setOpenDoc} refreshKey={refreshKey} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => { setSelection(null); setContent(""); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-display font-semibold text-foreground mb-1">{selection.topicName}</h3>
        <p className="text-xs text-muted-foreground">{selection.chapterName} • {selection.subjectName}</p>
        {saving && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving to history…</p>}
      </div>
      {loading && !content && (
        <div className="flex items-center gap-3 text-muted-foreground py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Generating explanation...
        </div>
      )}
      {content && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-6">
          <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Study Material</h4>
            <button
              onClick={() => doPrint(selection.topicName, selection.chapterName, selection.subjectName)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>
          <div id="learn-print-area">
            <StudyMarkdown content={content} />
          </div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary mt-4" />}
        </motion.div>
      )}
    </div>
  );
}
