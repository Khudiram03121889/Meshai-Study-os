import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Clock, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StudyDoc {
  id: string;
  mode: "prelearn" | "learn";
  topic_name: string;
  chapter_name: string | null;
  subject_name: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  content: string;
  created_at: string;
}

export default function StudyDocHistory({
  mode,
  onOpen,
  refreshKey,
}: {
  mode: "prelearn" | "learn";
  onOpen: (doc: StudyDoc) => void;
  refreshKey?: number;
}) {
  const [docs, setDocs] = useState<StudyDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("study_documents")
      .select("*")
      .eq("mode", mode)
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) toast.error("Failed to load history");
    setDocs((data as StudyDoc[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [mode, refreshKey]);

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = docs;
    setDocs((d) => d.filter((x) => x.id !== id));
    const { error } = await supabase.from("study_documents").delete().eq("id", id);
    if (error) { setDocs(prev); toast.error("Delete failed"); return; }
    toast.success("Deleted");
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading history…</div>;
  }

  if (docs.length === 0) {
    return (
      <div className="mt-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl py-8">
        No generated documents yet. Pick a topic above to generate your first one.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-foreground">Recent generated documents</h3>
        <span className="text-xs text-muted-foreground">({docs.length})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence>
          {docs.map((d, i) => (
            <motion.button
              key={d.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ y: -3 }}
              onClick={() => onOpen(d)}
              className="group relative text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">{d.topic_name}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {d.chapter_name} • {d.subject_name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-2">
                    {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    {new Date(d.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <button
                  onClick={(e) => remove(d.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
