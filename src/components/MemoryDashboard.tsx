import { useState, useEffect } from "react";
import { Brain, Trash2, Edit2, Loader2, Sparkles, SlidersHorizontal, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export function MemoryDashboard() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [memRes, prefRes] = await Promise.all([
        supabase.from("memories").select("*").order("created_at", { ascending: false }),
        supabase.from("user_preferences").select("*").single()
      ]);

      if (memRes.error) throw memRes.error;
      
      setMemories(memRes.data || []);
      if (prefRes.data) setPrefs(prefRes.data);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load memories");
    } finally {
      setLoading(false);
    }
  };

  const deleteMemory = async (id: string) => {
    try {
      await supabase.from("memories").delete().eq("id", id);
      setMemories(p => p.filter(m => m.id !== id));
      toast.success("Memory deleted");
    } catch (e) {
      toast.error("Failed to delete memory");
    }
  };

  const syncFromChats = async () => {
    setSyncing(true);
    const t = toast.loading("Scanning your chat history…");
    try {
      const { data, error } = await supabase.functions.invoke("ai-memory-backfill", { body: {} });
      if (error) throw error;
      toast.success(`Synced ${data?.convsProcessed ?? 0} conversations · ${data?.memoriesWritten ?? 0} new memories`, { id: t });
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Sync failed", { id: t });
    } finally {
      setSyncing(false);
    }
  };

  const filteredMemories = memories.filter(m => filter === "all" || m.memory_type === filter);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="p-6 h-full flex flex-col space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="text-primary" /> Memory Core
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Everything your AI Tutor has learned about you.
          </p>
        </div>
        <button
          onClick={syncFromChats}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors disabled:opacity-60"
        >
          {syncing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          {syncing ? "Syncing…" : "Sync from chat history"}
        </button>
      </div>

      {/* Preferences Section */}
      <div className="bg-card border rounded-lg p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <SlidersHorizontal size={18} /> Tutor Preferences
        </h2>
        {prefs ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Exam Priority</span>
              <p className="font-medium capitalize">{prefs.exam_priority}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Explanation Style</span>
              <p className="font-medium capitalize">{prefs.explanation_style}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Detail Level</span>
              <p className="font-medium capitalize">{prefs.detail_level}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Language</span>
              <p className="font-medium capitalize">{prefs.preferred_language}</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No preferences set yet. The AI will learn them as you chat.</p>
        )}
      </div>

      {/* Memories Section */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles size={18} /> Extracted Memories
          </h2>
          <div className="ml-auto flex gap-2">
            {["all", "mistake", "insight", "preference"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filteredMemories.map((mem) => (
              <motion.div
                key={mem.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border rounded-lg p-4 relative group"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    mem.memory_type === 'mistake' ? 'bg-red-500/10 text-red-500' :
                    mem.memory_type === 'insight' ? 'bg-green-500/10 text-green-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}>
                    {mem.memory_type}
                  </span>
                  
                  <button onClick={() => deleteMemory(mem.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <p className="text-sm">{mem.content}</p>
                
                {mem.subject_slug && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <BookOpen size={12} /> {mem.subject_slug}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredMemories.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No memories found. Chat with the AI tutor to generate insights!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
