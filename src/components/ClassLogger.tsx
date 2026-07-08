import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Send, CheckCircle2, Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useSubjects } from "@/data/syllabus";
import { useStudyStore, type StudyLog } from "@/data/store";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ClassLogger() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const { addLog, tracks } = useStudyStore();
  const classLevel = user ? Number(localStorage.getItem(`user_class_${user.id}`) || "12") : 12;

  // Tabs
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("ai");

  // Manual Mode State
  const [subjectId, setSubjectId] = useState("");
  const [lecturerId, setLecturerId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [understanding, setUnderstanding] = useState(3);
  const [notes, setNotes] = useState("");
  const [dbLecturers, setDbLecturers] = useState<any[]>([]);

  // AI Mode State
  const [quickText, setQuickText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<any>(null);

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

  // --- MANUAL MODE HELPERS ---
  const subject = subjects.find((s) => s.id === subjectId);
  const filteredChapters = subject?.chapters.filter((c) => c.class === classLevel) || [];
  const availableLecturers = dbLecturers.filter((l) => l.subject_id === subjectId);
  const chapter = filteredChapters.find((c) => c.id === chapterId);

  const currentTrack = tracks.find(
    (t) => t.lecturerId === lecturerId && t.chapterId === chapterId
  );
  const coveredTopicIds = currentTrack?.coveredTopicIds ?? [];

  const getChapterProgress = (chId: string) => {
    const track = tracks.find((t) => t.lecturerId === lecturerId && t.chapterId === chId);
    if (!track) return 0;
    const ch = filteredChapters.find((c) => c.id === chId);
    if (!ch || ch.topics.length === 0) return 0;
    return Math.round((track.coveredTopicIds.length / ch.topics.length) * 100);
  };

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleSubmit = () => {
    if (!subjectId || !lecturerId || !chapterId || selectedTopics.length === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    const log: StudyLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split("T")[0],
      subjectId,
      lecturerId,
      chapterId,
      topicIds: selectedTopics,
      understanding,
      notes: notes || undefined,
    };

    addLog(log);
    toast.success("Class session logged! 🎉");

    // Reset Manual fields
    setSubjectId("");
    setLecturerId("");
    setChapterId("");
    setSelectedTopics([]);
    setUnderstanding(3);
    setNotes("");
  };

  // --- AI MODE PARSING & SUBMISSION ---
  const handleParseQuickLog = async () => {
    if (!quickText.trim() && !image) {
      toast.error("Please enter a description or upload an image of your notes");
      return;
    }
    setParsing(true);
    setParsedResult(null);

    // Simplify syllabus metadata to send to the AI parser
    const simplifiedSubjects = subjects.map((s) => ({
      id: s.id,
      name: s.name,
      chapters: s.chapters
        .filter((c) => c.class === classLevel)
        .map((c) => ({
          id: c.id,
          name: c.name,
          topics: c.topics.map((t) => ({ id: t.id, name: t.name })),
        })),
    }));

    try {
      const { data, error } = await supabase.functions.invoke("parse-quick-log", {
        body: {
          text: quickText,
          image,
          lecturers: dbLecturers,
          subjects: simplifiedSubjects,
        },
      });

      if (error) throw error;

      if (!data || (!data.subjectId && !data.chapterId)) {
        toast.warning("AI couldn't map this to your syllabus. Try adding more details like the lecturer name, subject, or exact topics.");
      }

      setParsedResult(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to parse quick log");
    } finally {
      setParsing(false);
    }
  };

  // Helper overrides if AI matches are null or incorrect
  const handleParsedFieldChange = (field: string, value: any) => {
    setParsedResult((prev: any) => {
      const updated = { ...prev, [field]: value };
      if (field === "subjectId") {
        updated.lecturerId = null;
        updated.chapterId = null;
        updated.topicIds = [];
      } else if (field === "chapterId") {
        updated.topicIds = [];
      }
      return updated;
    });
  };

  const handleToggleParsedTopic = (topicId: string) => {
    setParsedResult((prev: any) => {
      const prevTopics = prev.topicIds || [];
      const updatedTopics = prevTopics.includes(topicId)
        ? prevTopics.filter((t: string) => t !== topicId)
        : [...prevTopics, topicId];
      return { ...prev, topicIds: updatedTopics };
    });
  };

  const handleLogParsedResult = () => {
    if (!parsedResult) return;
    const { subjectId: pSub, lecturerId: pLec, chapterId: pCh, topicIds: pTops, understanding: pUnd, notes: pNot } = parsedResult;

    if (!pSub || !pLec || !pCh || !pTops?.length) {
      toast.error("Please fill in any missing fields (Subject, Lecturer, Chapter, Topics)");
      return;
    }

    const log: StudyLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split("T")[0],
      subjectId: pSub,
      lecturerId: pLec,
      chapterId: pCh,
      topicIds: pTops,
      understanding: pUnd || 3,
      notes: pNot || undefined,
    };

    addLog(log);
    toast.success("Class session logged successfully! 🎉");
    
    // Clear AI inputs
    setQuickText("");
    setImage(null);
    setParsedResult(null);
  };

  // Resolved dynamic variables for parsed preview card
  const parsedSubject = parsedResult ? subjects.find((s) => s.id === parsedResult.subjectId) : null;
  const parsedChapters = parsedSubject?.chapters.filter((c) => c.class === classLevel) || [];
  const parsedLecturers = parsedResult ? dbLecturers.filter((l) => l.subject_id === parsedResult.subjectId) : [];
  const parsedChapter = parsedResult ? parsedChapters.find((c) => c.id === parsedResult.chapterId) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Log Class Session</h1>
          <p className="text-muted-foreground text-sm">Keep your syllabus track up to date.</p>
        </div>

        {/* Tab Selector */}
        <div className="bg-secondary/40 border border-border p-1 rounded-xl flex gap-1 self-start sm:self-center">
          <button
            onClick={() => setActiveTab("ai")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "ai"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Quick AI Log
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "manual"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Log Manually
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "ai" ? (
          <motion.div
            key="ai-logger"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  What did you learn today?
                </label>
                <p className="text-xs text-muted-foreground">
                  Type what topic your teacher covered and how well you got it.
                </p>
              </div>

              <textarea
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                placeholder="e.g. Jaffar sir finished Aldol condensation in Chemistry today. Understood most of it, but need to practice some numerical questions."
                className="w-full bg-background border border-border rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none h-32 focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={parsing}
              />

              {/* Image attachment section */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Or upload class notes / whiteboard photo (AI Vision OCR)
                </label>
                {!image ? (
                  <div className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center bg-secondary/15 hover:bg-secondary/30 hover:border-primary/40 transition-all cursor-pointer relative group min-h-[90px]">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={parsing}
                    />
                    <Sparkles className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-1.5 transition-colors" />
                    <p className="text-xs text-muted-foreground font-semibold group-hover:text-foreground transition-colors">
                      Click or drag a photo here to parse with AI Vision
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">Supports PNG, JPG, JPEG</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-secondary/30 border border-border p-2 rounded-xl relative">
                    <img
                      src={image}
                      alt="Notes preview"
                      className="w-12 h-12 object-cover rounded-lg border border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">Attached Notes Image</p>
                      <p className="text-[10px] text-muted-foreground">Ready for AI parsing</p>
                    </div>
                    <button
                      onClick={() => setImage(null)}
                      className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/20 transition-all mr-1"
                      disabled={parsing}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleParseQuickLog}
                disabled={parsing || (!quickText.trim() && !image)}
                className="w-full gradient-primary text-primary-foreground font-display font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing notes & transcribing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Process with AI
                  </>
                )}
              </button>
            </div>

            {/* AI Parsed Review Card */}
            {parsedResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-primary/20 rounded-xl p-5 space-y-4 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
                
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-foreground text-sm">AI Verification Preview</h3>
                </div>

                <div className="space-y-3.5 text-sm">
                  {/* Subject parsed field */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
                    <div className="flex gap-2">
                      {subjects.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleParsedFieldChange("subjectId", s.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            parsedResult.subjectId === s.id
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-secondary/40 border-border text-muted-foreground"
                          }`}
                        >
                          {s.icon} {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lecturer parsed field */}
                  {parsedResult.subjectId && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Lecturer</label>
                      <div className="flex flex-wrap gap-2">
                        {parsedLecturers.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => handleParsedFieldChange("lecturerId", l.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              parsedResult.lecturerId === l.id
                                ? "bg-primary/10 text-primary border-primary/30"
                                : "bg-secondary/40 border-border text-muted-foreground"
                            }`}
                          >
                            👨‍🏫 {l.name}
                          </button>
                        ))}
                        {parsedLecturers.length === 0 && (
                          <span className="text-xs text-warning flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> No lecturers configured for this subject</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chapter parsed field */}
                  {parsedResult.subjectId && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chapter</label>
                      <select
                        value={parsedResult.chapterId || ""}
                        onChange={(e) => handleParsedFieldChange("chapterId", e.target.value || null)}
                        className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="">-- Match Chapter --</option>
                        {parsedChapters.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Topics parsed field */}
                  {parsedChapter && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Topics Covered</label>
                      <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {parsedChapter.topics.map((t) => {
                          const isSel = (parsedResult.topicIds || []).includes(t.id);
                          return (
                            <button
                              key={t.id}
                              onClick={() => handleToggleParsedTopic(t.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all border ${
                                isSel
                                  ? "bg-primary/10 text-primary border-primary/30 font-medium"
                                  : "bg-secondary/40 border-border text-muted-foreground"
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSel ? "bg-primary border-primary" : "border-border"}`}>
                                {isSel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </div>
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Understanding Level */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Understanding Level</label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => handleParsedFieldChange("understanding", lvl)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            parsedResult.understanding === lvl
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-secondary/40 border-border text-muted-foreground"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes parsed field */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notes</label>
                    <textarea
                      value={parsedResult.notes || ""}
                      onChange={(e) => handleParsedFieldChange("notes", e.target.value)}
                      placeholder="Add brief details..."
                      className="w-full bg-secondary/30 border border-border rounded-lg p-3 text-xs text-foreground resize-none h-16 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setParsedResult(null)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/20 transition-all"
                  >
                    Clear Result
                  </button>
                  <button
                    onClick={handleLogParsedResult}
                    className="flex-1 gradient-primary text-primary-foreground font-display font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Confirm & Log
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="manual-logger"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Subject */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Subject</label>
              <div className="flex gap-2">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSubjectId(s.id); setLecturerId(""); setChapterId(""); setSelectedTopics([]); }}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                      subjectId === s.id ? "bg-primary/10 text-primary border-primary/30 glow-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.icon} {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Lecturer */}
            {subjectId && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <label className="text-sm font-medium text-foreground">Lecturer</label>
                <div className="flex gap-2">
                  {availableLecturers.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { setLecturerId(l.id); setChapterId(""); setSelectedTopics([]); }}
                      className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                        lecturerId === l.id ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {l.avatar || "👨‍🏫"} {l.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Chapter */}
            {lecturerId && subject && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <label className="text-sm font-medium text-foreground">Chapter</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredChapters.filter((c) => {
                    const otherTrack = tracks.find(
                      (t) => t.chapterId === c.id && t.lecturerId !== lecturerId
                    );
                    return !otherTrack;
                  }).map((c) => {
                    const pct = getChapterProgress(c.id);
                    const isComplete = pct === 100;
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setChapterId(c.id); setSelectedTopics([]); }}
                        className={`px-4 py-3 rounded-xl text-sm text-left transition-all border flex items-center justify-between gap-2 ${
                          chapterId === c.id
                            ? "bg-primary/10 text-primary border-primary/30"
                            : isComplete
                              ? "bg-accent/10 border-accent/30 text-accent"
                              : "bg-card border-border text-muted-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isComplete && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
                          {c.name}
                        </span>
                        {pct > 0 && (
                          <span className={`text-xs font-medium shrink-0 ${isComplete ? "text-accent" : "text-primary"}`}>
                            {pct}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Topics */}
            {chapter && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Topics Covered
                  {coveredTopicIds.length > 0 && (
                    <span className="ml-2 text-xs text-accent font-normal">
                      ({coveredTopicIds.length}/{chapter.topics.length} already done)
                    </span>
                  )}
                </label>
                <div className="space-y-2">
                  {chapter.topics.map((topic) => {
                    const selected = selectedTopics.includes(topic.id);
                    const alreadyCovered = coveredTopicIds.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all border ${
                          selected
                            ? "bg-primary/10 text-primary border-primary/30"
                            : alreadyCovered
                              ? "bg-accent/5 text-accent/70 border-accent/20"
                              : "bg-card border-border text-muted-foreground"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          selected
                            ? "bg-primary border-primary"
                            : alreadyCovered
                              ? "bg-accent/20 border-accent/40"
                              : "border-border"
                        }`}>
                          {(selected || alreadyCovered) && (
                            <Check className={`w-3 h-3 ${selected ? "text-primary-foreground" : "text-accent"}`} />
                          )}
                        </div>
                        <span className="flex-1">{topic.name}</span>
                        {alreadyCovered && !selected && (
                          <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">done</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Understanding */}
            {selectedTopics.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <label className="text-sm font-medium text-foreground">Understanding Level</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => setUnderstanding(level)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${
                        understanding === level ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {understanding <= 2 ? "😟 Need more practice" : understanding <= 3 ? "😐 Average" : understanding <= 4 ? "😊 Good understanding" : "🤩 Excellent!"}
                </p>
              </motion.div>
            )}

            {/* Notes */}
            {selectedTopics.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <label className="text-sm font-medium text-foreground">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific doubts or observations..."
                  className="w-full bg-card border border-border rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </motion.div>
            )}

            {/* Submit */}
            {selectedTopics.length > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleSubmit}
                className="w-full gradient-primary text-primary-foreground font-display font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Send className="w-4 h-4" />
                Log Session
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
