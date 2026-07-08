import { useState } from "react";
import { motion } from "framer-motion";
import { FastForward, Loader2, FileText, ArrowLeft } from "lucide-react";
import TopicSelector from "./TopicSelector";
import StudyMarkdown from "./StudyMarkdown";
import StudyDocHistory, { StudyDoc } from "./StudyDocHistory";
import StudyDocViewer from "./StudyDocViewer";
import { streamStudyMode } from "@/lib/studyModeApi";
import { useStudyStore } from "@/data/store";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function PreLearnMode() {
  const { tracks } = useStudyStore();
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
      mode: "prelearn",
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
        mode: "prelearn",
        topic: sel.topicName,
        chapter: sel.chapterName,
        subject: sel.subjectName,
        context: `Preparing before lecturer teaches this topic.`,
        onDelta: (chunk) => { accumulated += chunk; setContent(accumulated); },
        onDone: () => { setLoading(false); saveDoc(accumulated, sel); },
      });
    } catch (e: any) {
      setLoading(false);
      toast.error(e.message || "Failed to generate content");
    }
  };

  const handleExportPDF = (topicName: string, chapterName: string, subjectName: string, body: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Pop-up blocked"); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Pre-Learn: ${topicName}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; color: #000; background: #fff; padding: 40px 50px; line-height: 1.7; font-size: 13px; }
  h1 { font-size: 22px; margin-bottom: 6px; border-bottom: 2px solid #000; padding-bottom: 8px; }
  h2 { font-size: 17px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 14px; margin-top: 16px; margin-bottom: 6px; }
  p { margin-bottom: 10px; }
  ul, ol { margin-left: 20px; margin-bottom: 10px; }
  strong { font-weight: 700; }
  .header { text-align: center; margin-bottom: 30px; }
  .header p { font-size: 12px; color: #555; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="header">
  <h1>Pre-Learn: ${topicName}</h1>
  <p>Chapter: ${chapterName} | Subject: ${subjectName} | Study OS</p>
</div>
<div id="content"></div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>
<script>
  var html = marked.parse(${JSON.stringify(body)});
  html = html.replace(/\\$\\$([\\s\\S]*?)\\$\\$/g, function(m, tex) { try { return katex.renderToString(tex.trim(), {displayMode: true, throwOnError: false}); } catch(e) { return m; } });
  html = html.replace(/\\$([^\\$\\n]+?)\\$/g, function(m, tex) { try { return katex.renderToString(tex.trim(), {displayMode: false, throwOnError: false}); } catch(e) { return m; } });
  document.getElementById('content').innerHTML = html;
  setTimeout(() => window.print(), 800);
<\/script>
</body></html>`);
    printWindow.document.close();
  };

  // Viewer from history
  if (openDoc) {
    return (
      <StudyDocViewer
        doc={openDoc}
        onBack={() => setOpenDoc(null)}
        onExportPDF={() => handleExportPDF(openDoc.topic_name, openDoc.chapter_name || "", openDoc.subject_name || "", openDoc.content)}
      />
    );
  }

  if (!selection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <FastForward className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-lg">Pre-Learn Mode</h2>
            <p className="text-sm text-muted-foreground">Study topics before your lecturer teaches them</p>
          </div>
        </div>
        <TopicSelector onSelect={handleSelect} title="Select a topic to prepare in advance" />
        <StudyDocHistory mode="prelearn" onOpen={setOpenDoc} refreshKey={refreshKey} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => { setSelection(null); setContent(""); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {content && !loading && (
          <button onClick={() => handleExportPDF(selection.topicName, selection.chapterName, selection.subjectName, content)} className="flex items-center gap-2 text-sm bg-card border border-border px-4 py-2 rounded-xl hover:border-primary/30 transition-colors text-foreground">
            <FileText className="w-4 h-4" /> Export to PDF
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-display font-semibold text-foreground mb-1">{selection.topicName}</h3>
        <p className="text-xs text-muted-foreground">{selection.chapterName} • {selection.subjectName}</p>
        {saving && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving to history…</p>}
      </div>

      {loading && !content && (
        <div className="flex items-center gap-3 text-muted-foreground py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Generating pre-learn material...
        </div>
      )}

      {content && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-6">
          <StudyMarkdown content={content} />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary mt-4" />}
        </motion.div>
      )}
    </div>
  );
}
