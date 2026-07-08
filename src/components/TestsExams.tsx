import { useCallback, useEffect, useState } from "react";
import { emitEvent } from "@/lib/events";
import { Upload, Loader2, CheckCircle2, AlertCircle, ClipboardList, TrendingUp, FileText, ArrowLeft, Trash2, Calendar, Hash } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubjects } from "@/data/syllabus";
import { motion, AnimatePresence } from "framer-motion";
import TestPaperViewer from "./TestPaperViewer";

type Paper = {
  id: string;
  title: string;
  subject_id: string | null;
  exam_date: string | null;
  status: string;
  ai_analysis: string | null;
  storage_path: string | null;
  created_at: string;
};

type Question = {
  id: string;
  test_paper_id: string;
  question_text: string;
  topic: string | null;
  difficulty: string | null;
  marks: number | null;
  repeated_frequency: number | null;
};

export default function TestsExams() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjectId, setSubjectId] = useState(() => subjects[0]?.id || "physics");
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [openPaperId, setOpenPaperId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: ps }, { data: qs }] = await Promise.all([
      supabase.from("test_papers").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("test_questions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setPapers((ps as any) || []);
    setQuestions((qs as any) || []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`tests-rt:${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "test_papers" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  useEffect(() => {
    if (!user) return;
    const hasProcessing = papers.some((p) => p.status === "pending" || p.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      load();
    }, 5000);

    return () => clearInterval(interval);
  }, [user, papers, load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File too large (max 20MB)"); return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/tests/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("notes-pdfs").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = await supabase.storage.from("notes-pdfs").createSignedUrl(path, 60 * 60 * 24 * 7);

      const { data: paper, error: pErr } = await supabase.from("test_papers").insert({
        user_id: user.id,
        title: title.trim() || file.name,
        subject_id: subjectId,
        exam_date: examDate || null,
        pdf_url: urlData?.signedUrl || "",
        storage_path: path,
        status: "pending",
      }).select().single();
      if (pErr) throw pErr;

      setPapers((p) => [paper as any, ...p]);
      setTitle("");
      toast.success("Uploaded — extracting questions…");
      emitEvent('test.uploaded', { test_paper_id: paper!.id, subject_id: subjectId || undefined });
      supabase.functions.invoke("ingest-test", { body: { testPaperId: paper!.id } }).then(({ error }) => {
        if (error) toast.error("Processing failed: " + error.message);
        else load();
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deletePaper = async (paperId: string, storagePath: string | null) => {
    if (!confirm("Are you sure you want to completely delete this test paper?")) return;
    try {
      if (storagePath) {
        await supabase.storage.from("notes-pdfs").remove([storagePath]);
      }
      const { error } = await supabase.from("test_papers").delete().eq("id", paperId);
      if (error) throw error;
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
      toast.success("Test paper deleted");
    } catch (e: any) {
      console.error("Delete failed", e);
      toast.error(e.message || "Failed to delete test paper");
    }
  };

  const retryIngest = (paperId: string) => {
    setPapers((p) => p.map((p2) => (p2.id === paperId ? { ...p2, status: "processing", ai_analysis: null } : p2)));
    supabase.functions.invoke("ingest-test", { body: { testPaperId: paperId } }).then(({ error }) => {
      if (error) toast.error("Processing failed: " + error.message);
      else load();
    });
  };

  // pattern insights: topic frequency across all papers
  const topicCounts = questions.reduce<Record<string, number>>((acc, q) => {
    if (q.topic) acc[q.topic] = (acc[q.topic] || 0) + 1;
    return acc;
  }, {});
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const subjectColorClass = (sid?: string | null) => {
    if (sid === "physics") return "bg-[hsl(210,100%,56%)]";
    if (sid === "chemistry") return "bg-[hsl(160,84%,39%)]";
    if (sid === "mathematics") return "bg-[hsl(262,83%,58%)]";
    if (sid === "botany") return "bg-[hsl(120,60%,40%)]";
    if (sid === "zoology" || sid === "biology") return "bg-[hsl(340,75%,55%)]";
    return "bg-primary";
  };

  const subjectGlowClass = (sid?: string | null) => {
    if (sid === "physics") return "hover:shadow-[0_8px_30px_-8px_hsla(210,100%,56%,0.35)]";
    if (sid === "chemistry") return "hover:shadow-[0_8px_30px_-8px_hsla(160,84%,39%,0.35)]";
    if (sid === "mathematics") return "hover:shadow-[0_8px_30px_-8px_hsla(262,83%,58%,0.35)]";
    if (sid === "botany") return "hover:shadow-[0_8px_30px_-8px_hsla(120,60%,40%,0.35)]";
    if (sid === "zoology" || sid === "biology") return "hover:shadow-[0_8px_30px_-8px_hsla(340,75%,55%,0.35)]";
    return "hover:shadow-[0_8px_30px_-8px_hsla(160,84%,39%,0.35)]";
  };

  if (openPaperId) {
    return (
      <div>
        <button onClick={() => setOpenPaperId(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Tests & Exams
        </button>
        <TestPaperViewer paperId={openPaperId} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" /> Tests & Exams
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload test papers — AI extracts every question, detects repeated topics, and builds exam pattern intelligence.
        </p>
      </header>

      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-muted-foreground mb-1">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mid-term Physics 2026"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Subject</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Exam date</label>
          <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        </div>
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer gradient-primary text-primary-foreground text-sm ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload PDF/Image"}
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/jpg" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {topTopics.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Exam pattern — most repeated topics
          </h2>
          <div className="flex flex-wrap gap-2">
            {topTopics.map(([topic, count]) => (
              <span key={topic} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
                {topic} <span className="text-primary/70">× {count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {papers.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
          No test papers uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <AnimatePresence mode="popLayout">
            {papers.map((p, i) => {
              const qs = questions.filter((q) => q.test_paper_id === p.id);
              const extractedTopics = Array.from(new Set(qs.map(q => q.topic).filter(Boolean)));
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                  whileHover={{ y: -6, scale: 1.015, transition: { type: "spring", stiffness: 400, damping: 20 } }}
                  className={`group relative bg-card border border-border rounded-2xl overflow-hidden cursor-pointer ${subjectGlowClass(p.subject_id)} hover:border-primary/30 transition-colors`}
                  onClick={() => setOpenPaperId(p.id)}
                >
                  <div className={`h-1 w-full ${subjectColorClass(p.subject_id)}`} />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-foreground text-sm truncate leading-tight">{p.title}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                            {p.subject_id && <span className="capitalize">{p.subject_id}</span>}
                            {p.exam_date && (
                              <span className="flex items-center gap-1">
                                · <Calendar className="w-3 h-3" /> {new Date(p.exam_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            )}
                            {qs.length > 0 && <span>· {qs.length} questions</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {p.status === "ready" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                        {(p.status === "pending" || p.status === "processing") && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            <Loader2 className="w-3 h-3 animate-spin" /> Processing
                          </span>
                        )}
                        {p.status === "failed" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); retryIngest(p.id); }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                            title={p.ai_analysis || ""}
                          >
                            <AlertCircle className="w-3 h-3" /> Retry
                          </button>
                        )}
                      </div>
                    </div>

                    {p.ai_analysis && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{p.ai_analysis}</p>
                    )}

                    {extractedTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {extractedTopics.slice(0, 4).map((t: any, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                            <Hash className="w-3 h-3 opacity-60" />{t}
                          </span>
                        ))}
                        {extractedTopics.length > 4 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">+{extractedTopics.length - 4}</span>
                        )}
                      </div>
                    )}

                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePaper(p.id, p.storage_path); }}
                        className="p-1.5 rounded-md bg-background/80 backdrop-blur text-muted-foreground hover:text-red-400 hover:bg-red-400/10 border border-border transition-colors"
                        title="Delete test paper"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
