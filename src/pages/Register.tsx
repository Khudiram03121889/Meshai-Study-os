import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Eye, EyeOff, UserPlus, BookOpen, Plus, Trash2 } from "lucide-react";

interface RegisterProps {
  onToggle: () => void;
}

const BOARDS = [
  "CBSE",
  "ISC",
  "Karnataka State Board (PUC)",
  "Maharashtra State Board (HSC)",
  "Andhra Pradesh Board (BIEAP)",
  "Telangana Board (TSBIE)",
  "Tamil Nadu State Board",
  "Other State Board"
];

export default function Register({ onToggle }: RegisterProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [classLevel, setClassLevel] = useState<"11" | "12">("12");
  const [board, setBoard] = useState("CBSE");
  const [examCategory, setExamCategory] = useState<"JEE" | "NEET">("JEE");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Dynamic lecturer configurations
  // Each key maps a subject slug to an array of lecturer names
  const [lecturers, setLecturers] = useState<Record<string, string[]>>({
    physics: [""],
    chemistry: [""],
    mathematics: [""],
    botany: [""],
    zoology: [""]
  });

  const getActiveSubjects = () => {
    const base = [
      { id: "physics", name: "Physics" },
      { id: "chemistry", name: "Chemistry" }
    ];
    if (examCategory === "JEE") {
      return [...base, { id: "mathematics", name: "Mathematics" }];
    } else {
      return [
        ...base,
        { id: "botany", name: "Botany" },
        { id: "zoology", name: "Zoology" }
      ];
    }
  };

  // Adjust lecturers state when examCategory changes
  const handleExamChange = (category: "JEE" | "NEET") => {
    setExamCategory(category);
    if (category === "JEE") {
      setLecturers({
        physics: lecturers.physics || [""],
        chemistry: lecturers.chemistry || [""],
        mathematics: lecturers.mathematics || [""]
      });
    } else {
      setLecturers({
        physics: lecturers.physics || [""],
        chemistry: lecturers.chemistry || [""],
        botany: lecturers.botany || [""],
        zoology: lecturers.zoology || [""]
      });
    }
  };

  const handleAddLecturer = (subjId: string) => {
    const list = lecturers[subjId] || [""];
    if (list.length >= 3) {
      toast.warning("Maximum of 3 lecturers per subject");
      return;
    }
    setLecturers(prev => ({
      ...prev,
      [subjId]: [...list, ""]
    }));
  };

  const handleRemoveLecturer = (subjId: string, index: number) => {
    const list = lecturers[subjId] || [""];
    if (list.length <= 1) {
      toast.warning("At least one lecturer is required per subject");
      return;
    }
    setLecturers(prev => ({
      ...prev,
      [subjId]: list.filter((_, i) => i !== index)
    }));
  };

  const handleLecturerNameChange = (subjId: string, index: number, val: string) => {
    const list = [...(lecturers[subjId] || [""])];
    list[index] = val;
    setLecturers(prev => ({
      ...prev,
      [subjId]: list
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name || !email || !password) {
      toast.error("Please fill in basic fields");
      return;
    }

    const activeSubjects = getActiveSubjects();

    // Prepare lecturers, filling empty names with placeholders
    const finalLecturers = {
      ...lecturers,
      ...Object.fromEntries(
        activeSubjects.map(sub => {
          const names = lecturers[sub.id] || [];
          const filled = names.map((n, i) => n.trim() ? n : `Lecturer ${i + 1}`);
          return [sub.id, filled];
        })
      ),
    };

    setLoading(true);

    try {
      // 1. Sign up user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (signUpError) throw signUpError;
      const registeredUser = data.user;
      if (!registeredUser) throw new Error("Failed to register user");

      // 2. Set user preferences
      const { error: prefError } = await supabase.from("user_preferences").upsert({
        user_id: registeredUser.id,
        exam_priority: examCategory.toLowerCase(),
        board: board,
        explanation_style: "balanced",
        preferred_language: "english",
        detail_level: "medium",
        quiz_style: "mcq",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (prefError) console.error("Pref error", prefError);

      // Cache preferences locally for immediate synchronous frontend access
      localStorage.setItem(`user_class_${registeredUser.id}`, classLevel);
      localStorage.setItem(`user_exam_${registeredUser.id}`, examCategory.toLowerCase());
      localStorage.setItem(`user_board_${registeredUser.id}`, board);

      // 3. Seed subjects based on NEET/JEE select
      const subjectsToInsert = activeSubjects.map(sub => ({
        user_id: registeredUser.id,
        name: sub.name,
        slug: sub.id
      }));

      const { error: subjError } = await supabase.from("subjects").insert(subjectsToInsert);
      if (subjError) console.error("Subjects error", subjError);

      // Cache subjects slugs locally
      const subjectSlugs = activeSubjects.map(s => s.id);
      localStorage.setItem(`user_subjects_${registeredUser.id}`, JSON.stringify(subjectSlugs));

      // 4. Seed dynamic lecturers list
      const lecturersToInsert: { user_id: string; name: string; subject_id: string }[] = [];
      activeSubjects.forEach(sub => {
        const names = finalLecturers[sub.id] || [];
        names.forEach(nName => {
          if (nName.trim()) {
            lecturersToInsert.push({
              user_id: registeredUser.id,
              name: nName.trim(),
              subject_id: sub.id
            });
          }
        });
      });

      const { error: lectError } = await supabase.from("lecturers").insert(lecturersToInsert);
      if (lectError) console.error("Lecturers error", lectError);

      toast.success("Account created successfully! Log in to get started.");
      onToggle();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during registration");
    } finally {
      setLoading(false);
    }
  };

  const activeSubjects = getActiveSubjects();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-y-auto py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">MeshStudy AI</h1>
          <p className="text-muted-foreground text-sm mt-1">Multi-Tenant Personalized Academic Coach</p>
        </div>

        <form onSubmit={handleRegister} className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl">
          <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" /> Create Account
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Class Standard</label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value as "11" | "12")}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-9"
              >
                <option value="11">Class 11 (1st PUC)</option>
                <option value="12">Class 12 (2nd PUC)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Compulsory Board</label>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-9"
              >
                {BOARDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Competitive Stream</label>
              <select
                value={examCategory}
                onChange={(e) => handleExamChange(e.target.value as "JEE" | "NEET")}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-9"
              >
                <option value="JEE">JEE (Physics, Chemistry, Maths)</option>
                <option value="NEET">NEET (Physics, Chemistry, Botany, Zoology)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-2 space-y-4">
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" /> Configure Subject Lecturers
            </h3>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {activeSubjects.map((sub) => {
                const list = lecturers[sub.id] || [""];
                return (
                  <div key={sub.id} className="bg-secondary/20 border border-border/50 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1">
                        {sub.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddLecturer(sub.id)}
                        className="text-[10px] text-primary hover:text-primary-hover font-semibold flex items-center gap-0.5 border border-primary/20 rounded-lg px-2 py-1 bg-primary/5 hover:bg-primary/10 transition-all"
                      >
                        <Plus className="w-3 h-3" /> Add Lecturer
                      </button>
                    </div>

                    <div className="space-y-2">
                      {list.map((nameVal, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={nameVal}
                  onChange={(e) => handleLecturerNameChange(sub.id, idx, e.target.value)}
                  placeholder="e.g. Jaffar Sir"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
                          {list.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLecturer(sub.id, idx)}
                              className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg border border-border transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-primary-foreground font-display font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 mt-4 text-sm shadow-md"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <button onClick={onToggle} className="text-primary hover:underline font-semibold">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}
