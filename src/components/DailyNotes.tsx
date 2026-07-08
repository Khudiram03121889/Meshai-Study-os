import { useState, useEffect, useCallback, useMemo } from "react";
import { emitEvent } from "@/lib/events";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  ArrowLeft, RefreshCcw, Trash2, ChevronLeft, ChevronRight,
  Calendar, Hash,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubjects } from "@/data/syllabus";
import { getUserLecturers } from "@/lib/lecturers";
import NoteViewer from "./NoteViewer";

type Note = {
  id: string;
  file_name: string;
  storage_path: string;
  status: string;
  ai_summary: string | null;
  detected_topics: string[] | null;
  error_message: string | null;
  created_at: string;
  class_session_id: string;
};

type Session = {
  id: string;
  session_date: string;
  subject_id: string;
  lecturer_id: string | null;
  title: string | null;
  summary: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function DailyNotes() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [date, setDate] = useState(today());
  const [subjectId, setSubjectId] = useState(() => subjects[0]?.id || "physics");
  const [lecturerStaticId, setLecturerStaticId] = useState<string>("");
  const [dbLecturers, setDbLecturers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [uploading, setUploading] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const NOTES_PER_PAGE = 10;

  const subjectLecturers = useMemo(
    () => dbLecturers.filter((l) => l.subject_id === subjectId),
    [dbLecturers, subjectId],
  );

  useEffect(() => {
    if (subjectLecturers.length && !subjectLecturers.find((l) => l.id === lecturerStaticId)) {
      setLecturerStaticId(subjectLecturers[0].id);
    } else if (!subjectLecturers.length) {
      setLecturerStaticId("");
    }
  }, [subjectId, subjectLecturers, lecturerStaticId]);

  useEffect(() => {
    if (!user) return;
    getUserLecturers(user.id).then(setDbLecturers).catch((e) => console.error(e));
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: ss } = await supabase
      .from("class_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("session_date", date)
      .eq("subject_id", subjectId);
    const sessIds = (ss || []).map((s: any) => s.id);
    setSessions((ss as any) || []);
    if (sessIds.length) {
      const { data: ns } = await supabase
        .from("notes")
        .select("*")
        .in("class_session_id", sessIds)
        .order("created_at", { ascending: false });
      setNotes((ns as any) || []);
    } else {
      setNotes([]);
    }
    setLoading(false);
  }, [user, date, subjectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(0); }, [date, subjectId]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`daily-notes-rt:${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notes" }, (payload) => {
        const updated = payload.new as Note;
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const hasProcessing = notes.some((n) => n.status === "pending" || n.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      load();
    }, 5000);

    return () => clearInterval(interval);
  }, [user, notes, load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    // lectUuid can be empty if no lecturers configured for this subject — that's OK
    const lectUuid = lecturerStaticId || null;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20MB)");
      return;
    }

    setUploading(true);
    try {
      let session = sessions.find((s) => lectUuid ? s.lecturer_id === lectUuid : !s.lecturer_id);
      if (!session) {
        const { data: created, error: sErr } = await supabase
          .from("class_sessions")
          .insert({ user_id: user.id, subject_id: subjectId, lecturer_id: lectUuid || null, session_date: date })
          .select()
          .single();
        if (sErr) throw sErr;
        session = created as any;
        setSessions((p) => [...p, session as Session]);
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${date}/${subjectId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("notes-pdfs").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { data: urlData } = await supabase.storage.from("notes-pdfs").createSignedUrl(path, 60 * 60 * 24 * 7);

      const { data: note, error: nErr } = await supabase.from("notes").insert({
        user_id: user.id,
        class_session_id: session!.id,
        file_name: file.name,
        pdf_url: urlData?.signedUrl || "",
        storage_path: path,
        mime_type: file.type,
        status: "pending",
      }).select().single();
      if (nErr) throw nErr;

      setNotes((p) => [note as any, ...p]);
      toast.success("Uploaded — processing in background");
      emitEvent('note.uploaded', { note_id: note!.id, file_name: file.name });

      supabase.functions.invoke("ingest-note", { body: { noteId: note!.id } }).then(async ({ error }) => {
        if (error) {
          console.error(error);
          let errMsg = error.message;
          if (error.context && typeof error.context.json === 'function') {
            try {
              const errBody = await error.context.json();
              if (errBody && errBody.error) errMsg = errBody.error;
            } catch { /* ignore */ }
          }
          toast.error("Processing failed: " + errMsg);
        }
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const retryIngest = (noteId: string) => {
    setNotes((p) => p.map((n) => (n.id === noteId ? { ...n, status: "processing", error_message: null } : n)));
    supabase.functions.invoke("ingest-note", { body: { noteId } });
  };

  const deleteNote = async (noteId: string, storagePath: string) => {
    if (!confirm("Are you sure you want to completely delete this note?")) return;
    try {
      if (storagePath) {
        await supabase.storage.from("notes-pdfs").remove([storagePath]);
      }
      const { error } = await supabase.from("notes").delete().eq("id", noteId);
      if (error) throw error;
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } catch (e: any) {
      console.error("Delete failed", e);
      toast.error(e.message || "Failed to delete note");
    }
  };

  const sessionSubjectMap = useMemo(() => {
    const map: Record<string, string> = {};
    sessions.forEach((s) => { map[s.id] = s.subject_id; });
    return map;
  }, [sessions]);

  const subjectColorClass = (sid?: string) => {
    if (sid === "physics") return "bg-[hsl(210,100%,56%)]";
    if (sid === "chemistry") return "bg-[hsl(160,84%,39%)]";
    if (sid === "mathematics") return "bg-[hsl(262,83%,58%)]";
    if (sid === "botany") return "bg-[hsl(120,60%,40%)]";
    if (sid === "zoology" || sid === "biology") return "bg-[hsl(340,75%,55%)]";
    return "bg-primary";
  };

  const subjectGlowClass = (sid?: string) => {
    if (sid === "physics") return "hover:shadow-[0_8px_30px_-8px_hsla(210,100%,56%,0.35)]";
    if (sid === "chemistry") return "hover:shadow-[0_8px_30px_-8px_hsla(160,84%,39%,0.35)]";
    if (sid === "mathematics") return "hover:shadow-[0_8px_30px_-8px_hsla(262,83%,58%,0.35)]";
    if (sid === "botany") return "hover:shadow-[0_8px_30px_-8px_hsla(120,60%,40%,0.35)]";
    if (sid === "zoology" || sid === "biology") return "hover:shadow-[0_8px_30px_-8px_hsla(340,75%,55%,0.35)]";
    return "hover:shadow-[0_8px_30px_-8px_hsla(160,84%,39%,0.35)]";
  };

  const totalPages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  const paginatedNotes = notes.slice(page * NOTES_PER_PAGE, (page + 1) * NOTES_PER_PAGE);

  if (openNoteId) {
    return (
      <div>
        <button onClick={() => setOpenNoteId(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Daily Notes
        </button>
        <NoteViewer noteId={openNoteId} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Daily Notes</h1>
        <p className="text-muted-foreground text-sm">Upload class notes (PDF or whiteboard images) — each file gets its own memory-aware AI tutor.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Subject</label>
          <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setSubjectId(s.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${subjectId === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Lecturer</label>
          {subjectLecturers.length === 0 ? (
            <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground italic">
              No lecturer configured — upload will proceed without one
            </div>
          ) : (
            <select
              value={lecturerStaticId}
              onChange={(e) => setLecturerStaticId(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {subjectLecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.avatar} {l.name}</option>
              ))}
            </select>
          )}
        </div>
        <label className={`ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer gradient-primary text-primary-foreground text-sm ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload PDF/Image"}
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/jpg" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 bg-card/60 border border-border border-dashed rounded-2xl"
        >
          <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No notes uploaded for this day yet.</p>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <AnimatePresence mode="popLayout">
              {paginatedNotes.map((n, i) => {
                const sId = sessionSubjectMap[n.class_session_id];
                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                    whileHover={{ y: -6, scale: 1.015, transition: { type: "spring", stiffness: 400, damping: 20 } }}
                    className={`group relative bg-card border border-border rounded-2xl overflow-hidden cursor-pointer ${subjectGlowClass(sId)} hover:border-primary/30 transition-colors`}
                    onClick={() => setOpenNoteId(n.id)}
                  >
                    <div className={`h-1 w-full ${subjectColorClass(sId)}`} />

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-foreground text-sm truncate leading-tight">{n.file_name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {n.status === "ready" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                          {(n.status === "pending" || n.status === "processing") && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                              <Loader2 className="w-3 h-3 animate-spin" /> Processing
                            </span>
                          )}
                          {n.status === "failed" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); retryIngest(n.id); }}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                              title={n.error_message || ""}
                            >
                              <AlertCircle className="w-3 h-3" /> Retry
                            </button>
                          )}
                        </div>
                      </div>

                      {n.ai_summary && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{n.ai_summary}</p>
                      )}

                      {n.detected_topics && n.detected_topics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {n.detected_topics.slice(0, 4).map((t, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                              <Hash className="w-3 h-3 opacity-60" />{t}
                            </span>
                          ))}
                          {n.detected_topics.length > 4 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">+{n.detected_topics.length - 4}</span>
                          )}
                        </div>
                      )}

                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNote(n.id, n.storage_path); }}
                          className="p-1.5 rounded-md bg-background/80 backdrop-blur text-muted-foreground hover:text-red-400 hover:bg-red-400/10 border border-border transition-colors"
                          title="Delete note"
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                      page === i
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
