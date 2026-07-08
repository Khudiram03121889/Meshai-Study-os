import { supabase } from "@/integrations/supabase/client";

export async function seedDemoData(userId: string): Promise<void> {
  // 1. Clean existing user data to start fresh
  const deletePromises = [
    supabase.from("question_attempts").delete().eq("user_id", userId),
    supabase.from("study_logs").delete().eq("user_id", userId),
    supabase.from("track_progress").delete().eq("user_id", userId),
    supabase.from("memories").delete().eq("user_id", userId),
    supabase.from("chat_messages").delete().eq("user_id", userId),
    supabase.from("chat_conversations").delete().eq("user_id", userId),
    supabase.from("lecturers").delete().eq("user_id", userId),
  ];
  await Promise.all(deletePromises);

  // 2. Insert standard PCM lecturers
  const { data: lecturers, error: lectError } = await supabase
    .from("lecturers")
    .insert([
      { user_id: userId, name: "Dr. HC Verma", subject_id: "physics" },
      { user_id: userId, name: "Prof. RD Sharma", subject_id: "mathematics" },
      { user_id: userId, name: "Dr. OP Tandon", subject_id: "chemistry" },
    ])
    .select();

  if (lectError || !lecturers || lecturers.length < 3) {
    throw new Error("Failed to seed lecturers: " + (lectError?.message || "Unknown error"));
  }

  const physicsLecturerId = lecturers.find(l => l.subject_id === "physics")!.id;
  const mathsLecturerId = lecturers.find(l => l.subject_id === "mathematics")!.id;
  const chemistryLecturerId = lecturers.find(l => l.subject_id === "chemistry")!.id;

  // 3. Insert Study Logs & Track Progress
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const logs = [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      subject_id: "physics",
      lecturer_id: physicsLecturerId,
      chapter_id: "phy-ch1",
      topic_ids: ["phy-1-1", "phy-1-2"],
      understanding: 3,
      notes: "Confused about how Coulomb's law applies to medium permittivity.",
      date: fiveDaysAgo,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      subject_id: "physics",
      lecturer_id: physicsLecturerId,
      chapter_id: "phy-ch3",
      topic_ids: ["phy-3-1", "phy-3-5"],
      understanding: 2,
      notes: "Need practice on Kirchhoff's Junction and Loop rules.",
      date: threeDaysAgo,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      subject_id: "mathematics",
      lecturer_id: mathsLecturerId,
      chapter_id: "math-ch10",
      topic_ids: ["math-10-4", "math-10-5"],
      understanding: 4,
      notes: "Felt good about dot and cross products. Need to remember projections.",
      date: twoDaysAgo,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      subject_id: "chemistry",
      lecturer_id: chemistryLecturerId,
      chapter_id: "chem-ch8",
      topic_ids: ["chem-8-6"],
      understanding: 1,
      notes: "Extremely confused about the alpha-hydrogen abstraction mechanism.",
      date: today,
    },
  ];

  await supabase.from("study_logs").insert(logs);

  // Insert corresponding tracks
  const tracks = [
    {
      user_id: userId,
      lecturer_id: physicsLecturerId,
      chapter_id: "phy-ch1",
      covered_topic_ids: ["phy-1-1", "phy-1-2"],
      last_updated: fiveDaysAgo,
    },
    {
      user_id: userId,
      lecturer_id: physicsLecturerId,
      chapter_id: "phy-ch3",
      covered_topic_ids: ["phy-3-1", "phy-3-5"],
      last_updated: threeDaysAgo,
    },
    {
      user_id: userId,
      lecturer_id: mathsLecturerId,
      chapter_id: "math-ch10",
      covered_topic_ids: ["math-10-4", "math-10-5"],
      last_updated: twoDaysAgo,
    },
    {
      user_id: userId,
      lecturer_id: chemistryLecturerId,
      chapter_id: "chem-ch8",
      covered_topic_ids: ["chem-8-6"],
      last_updated: today,
    },
  ];

  await supabase.from("track_progress").insert(tracks);

  // 4. Insert Memories (Revision Queue & Weak Areas)
  const memories = [
    {
      user_id: userId,
      memory_type: "revision",
      content: "Revision needed for: Coulomb's Law. Confidence: 60%",
      subject_slug: "physics",
      confidence_score: 0.6,
      source: "user_upload",
      metadata: { topic: "Coulomb's Law", chapterId: "phy-ch1", topicId: "phy-1-1", last_revised: fiveDaysAgo, revision_count: 0 },
    },
    {
      user_id: userId,
      memory_type: "revision",
      content: "Revision needed for: Ohm's Law. Confidence: 40%",
      subject_slug: "physics",
      confidence_score: 0.4,
      source: "user_upload",
      metadata: { topic: "Ohm's Law", chapterId: "phy-ch3", topicId: "phy-3-1", last_revised: threeDaysAgo, revision_count: 0 },
    },
    {
      user_id: userId,
      memory_type: "weak_area",
      content: "Topic: Kirchhoff's Laws\nNotes: Need practice on Kirchhoff's Junction and Loop rules.",
      subject_slug: "physics",
      confidence_score: 0.4,
      source: "user_upload",
      metadata: { topic: "Kirchhoff's Laws", chapterId: "phy-ch3", topicId: "phy-3-5" },
    },
    {
      user_id: userId,
      memory_type: "revision",
      content: "Revision needed for: Scalar (Dot) Product. Confidence: 80%",
      subject_slug: "mathematics",
      confidence_score: 0.8,
      source: "user_upload",
      metadata: { topic: "Scalar (Dot) Product", chapterId: "math-ch10", topicId: "math-10-4", last_revised: twoDaysAgo, revision_count: 0 },
    },
    {
      user_id: userId,
      memory_type: "weak_area",
      content: "Topic: Aldol Condensation\nNotes: Extremely confused about the alpha-hydrogen abstraction mechanism.",
      subject_slug: "chemistry",
      confidence_score: 0.2,
      source: "user_upload",
      metadata: { topic: "Aldol Condensation", chapterId: "chem-ch8", topicId: "chem-8-6" },
    },
    {
      user_id: userId,
      memory_type: "preference",
      content: "Prefers visual derivations for Physics equations",
      confidence_score: 0.9,
      source: "reflection",
    },
    {
      user_id: userId,
      memory_type: "preference",
      content: "Struggles with organic reaction mechanisms in Chemistry",
      confidence_score: 0.8,
      source: "reflection",
    },
  ];

  await supabase.from("memories").insert(memories);

  // 5. Insert Question Attempts (to show performance stats)
  const attempts = [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      date: threeDaysAgo,
      mode: "practice",
      subject_id: "physics",
      chapter_id: "phy-ch3",
      topic_id: "phy-3-5",
      question: "State Kirchhoff's junction rule.",
      options: ["Sum of currents entering is equal to sum of currents leaving", "Sum of potential drops is zero", "Current is proportional to voltage", "Resistance is constant"],
      correct_answer: "Sum of currents entering is equal to sum of currents leaving",
      student_answer: "Sum of currents entering is equal to sum of currents leaving",
      is_correct: true,
      time_spent: 45,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      date: threeDaysAgo,
      mode: "practice",
      subject_id: "physics",
      chapter_id: "phy-ch3",
      topic_id: "phy-3-5",
      question: "In a closed loop, the algebraic sum of changes in potential is...",
      options: ["zero", "non-zero", "proportional to current", "infinite"],
      correct_answer: "zero",
      student_answer: "non-zero",
      is_correct: false,
      mistake_type: "conceptual",
      explanation: "Kirchhoff's loop law states that sum of potential differences in any closed loop is zero, based on energy conservation.",
      time_spent: 120,
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      date: today,
      mode: "practice",
      subject_id: "chemistry",
      chapter_id: "chem-ch8",
      topic_id: "chem-8-6",
      question: "Which of the following compounds will undergo Aldol condensation?",
      options: ["Acetaldehyde", "Benzaldehyde", "Formaldehyde", "Trimethylacetaldehyde"],
      correct_answer: "Acetaldehyde",
      student_answer: "Benzaldehyde",
      is_correct: false,
      mistake_type: "conceptual",
      explanation: "Acetaldehyde has alpha-hydrogens required for Aldol condensation. Benzaldehyde lacks alpha-hydrogens.",
      time_spent: 90,
    },
  ];

  await supabase.from("question_attempts").insert(attempts);

  // 6. Insert chat conversations and messages with model routing tags
  const { data: conv, error: convError } = await supabase
    .from("chat_conversations")
    .insert({ user_id: userId, title: "Kirchhoff's Laws & Aldol Condensation" })
    .select("id")
    .single();

  if (convError || !conv) {
    throw new Error("Failed to seed chat conversation: " + (convError?.message || "Unknown error"));
  }

  const messages = [
    {
      conversation_id: conv.id,
      user_id: userId,
      role: "user",
      content: "Explain Kirchhoff's Loop Law with an example.",
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      conversation_id: conv.id,
      user_id: userId,
      role: "assistant",
      content: "Certainly! **Kirchhoff's Loop Law (KVL)** states that the algebraic sum of changes in potential around any closed loop must be zero:\n\n$$\\sum V = 0$$\n\nThis is a consequence of conservation of energy.\n\n*Example:* If you trace a simple loop with a $12\\text{V}$ battery and two resistors $R_1 = 4\\Omega$ and $R_2 = 2\\Omega$, the current is:\n\n$$I = \\frac{12\\text{V}}{4\\Omega + 2\\Omega} = 2\\text{A}$$\n\nApplying KVL:\n\n$$12\\text{V} - I R_1 - I R_2 = 12 - 8 - 4 = 0\\text{V}$$",
      model_routed: "openai/gpt-4o",
      created_at: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
    },
    {
      conversation_id: conv.id,
      user_id: userId,
      role: "user",
      content: "What about Aldol condensation mechanism?",
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      conversation_id: conv.id,
      user_id: userId,
      role: "assistant",
      content: "Here is the step-by-step mechanism of **Aldol Condensation**:\n\n1. **Enolate Formation**: A strong base abstracts an $\\alpha$-hydrogen from the aldehyde or ketone to form a nucleophilic enolate ion.\n2. **Nucleophilic Attack**: The enolate attacks the electrophilic carbonyl carbon of another aldehyde/ketone molecule.\n3. **Protonation**: The alkoxide ion formed is protonated by water, yielding a $\\beta$-hydroxy aldehyde (aldol).\n4. **Dehydration (if heated)**: Elimination of water leads to an $\\alpha,\\beta$-unsaturated carbonyl compound.",
      model_routed: "google/gemini-1.5-pro",
      created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    },
    {
      conversation_id: conv.id,
      user_id: userId,
      role: "user",
      content: "Vector cross product derivation please.",
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      conversation_id: conv.id,
      user_id: userId,
      role: "assistant",
      content: "The **cross product** of two vectors $\\vec{a}$ and $\\vec{b}$ results in a vector perpendicular to both, given by:\n\n$$\\vec{a} \\times \\vec{b} = (a_y b_z - a_z b_y)\\hat{i} + (a_z b_x - a_x b_z)\\hat{j} + (a_x b_y - a_y b_x)\\hat{k}$$\n\nIts magnitude represents the area of the parallelogram formed by the two vectors:\n\n$$\\|\\vec{a} \\times \\vec{b}\\| = \\|\\vec{a}\\| \\|\\vec{b}\\| \\sin\\theta$$",
      model_routed: "anthropic/claude-3-5-sonnet",
      created_at: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    },
  ];

  await supabase.from("chat_messages").insert(messages as any);
}
