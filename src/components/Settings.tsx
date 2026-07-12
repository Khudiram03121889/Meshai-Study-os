import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Download, Trash2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubjects } from "@/data/syllabus";
import { resetLecturerCache } from "@/lib/lecturers";
import { seedDemoData } from "@/lib/seed-demo-data";
import { useStudyStore } from "@/data/store";

export default function Settings() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [dbLecturers, setDbLecturers] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newSubj, setNewSubj] = useState("");
  const [seeding, setSeeding] = useState(false);
  const { loadFromDb } = useStudyStore();

  const handleSeedDemoData = async () => {
    if (!user) return;
    const confirmSeed = window.confirm(
      "Warning: This will delete your current notes, study logs, chat history, and lecturers, replacing them with standard demo data. Do you want to proceed?"
    );
    if (!confirmSeed) return;

    setSeeding(true);
    toast.message("Populating demo data...");
    try {
      await seedDemoData(user.id);
      await loadFromDb();
      resetLecturerCache();
      await fetchLecturers();
      toast.success("Account seeded successfully! 🎉");
    } catch (err: any) {
      toast.error("Failed to seed account: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const fetchLecturers = async () => {
    if (!user) return;
    const { data } = await supabase.from("lecturers").select("*").eq("user_id", user.id).order("name");
    if (data) setDbLecturers(data);
  };

  useEffect(() => {
    fetchLecturers();
  }, [user]);

  useEffect(() => {
    if (subjects.length > 0 && !newSubj) {
      setNewSubj(subjects[0].id);
    }
  }, [subjects, newSubj]);

  const handleAddLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim() || !newSubj) return;

    const count = dbLecturers.filter((l) => l.subject_id === newSubj).length;
    if (count >= 3) {
      toast.warning("Maximum of 3 lecturers per subject");
      return;
    }

    const { data, error } = await supabase
      .from("lecturers")
      .insert({
        user_id: user.id,
        name: newName.trim(),
        subject_id: newSubj
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Added lecturer ${newName}`);
      setNewName("");
      resetLecturerCache();
      fetchLecturers();
    }
  };

  const handleDeleteLecturer = async (id: string, name: string) => {
    const { error } = await supabase.from("lecturers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Removed lecturer ${name}`);
      resetLecturerCache();
      fetchLecturers();
    }
  };

  const exportData = async () => {
    if (!user) return;
    toast.message("Preparing export…");
    const tables = ["notes", "class_sessions", "lecturers", "test_papers", "test_questions", "memories", "user_preferences", "ai_chat_history", "question_attempts", "study_logs"] as const;
    const dump: Record<string, any> = {};
    for (const t of tables) {
      // user_preferences uses user_id instead of auth.uid() as primary reference, but check how RLS is configured. RLS is on all tables matching user_id.
      const { data } = await supabase.from(t).select("*").eq("user_id", user.id);
      dump[t] = data || [];
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-os-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your preferences and export your study data.</p>
      </header>

      {/* Manage Lecturers */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Manage Lecturers</h2>
        </div>
        <p className="text-xs text-muted-foreground">View, add, and remove the lecturers who teach you. These lecturers will appear in your class logger, timeline, and dashboard.</p>
        
        {/* Add Lecturer Form */}
        <form onSubmit={handleAddLecturer} className="flex flex-col sm:flex-row gap-2 max-w-lg">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Lecturer Name (e.g. Dr. Verma)"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10"
            required
          />
          <select
            value={newSubj}
            onChange={(e) => setNewSubj(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-10 sm:w-44"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium h-10 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>

        {/* Lecturers List */}
        <div className="pt-2">
          {subjects.map((sub) => {
            const list = dbLecturers.filter((l) => l.subject_id === sub.id);
            return (
              <div key={sub.id} className="border-t border-border/50 py-3 first:border-t-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  {sub.icon} {sub.name}
                </span>
                
                <div className="flex flex-wrap gap-2">
                  {list.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No lecturers configured</span>
                  ) : (
                    list.map((lect) => (
                      <div key={lect.id} className="inline-flex items-center gap-1.5 bg-secondary/40 border border-border px-3 py-1 rounded-full text-xs text-foreground">
                        <span>{lect.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLecturer(lect.id, lect.name)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-1 p-0.5"
                          title={`Remove ${lect.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Seed Demo Data */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span>✨</span> Populate Demo Data
        </h2>
        <p className="text-xs text-muted-foreground">
          Clear your current database and populate it with rich, realistic study logs, active lecturer tracks, question attempts, revision items, and simulated AI tutor chats routed through GPT-4o, Gemini 1.5 Pro, and Claude 3.5 Sonnet via Mesh API.
        </p>
        <button
          onClick={handleSeedDemoData}
          disabled={seeding}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/95 disabled:opacity-50 transition-all shadow-sm"
        >
          {seeding ? (
            <>
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Seeding data...
            </>
          ) : (
            <>
              <span>✨</span> Seed Account
            </>
          )}
        </button>
      </section>

      {/* Export data */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-2">Data export</h2>
        <p className="text-xs text-muted-foreground mb-3">Download all your notes, sessions, tests, memory and progress as a single JSON file.</p>
        <button onClick={exportData} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm">
          <Download className="w-4 h-4" /> Export my data
        </button>
      </section>
    </div>
  );
}
