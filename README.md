# StudyOS V2 — Lecturer-Centric Study Graph & Multi-Model AI Tutor

StudyOS V2 is an AI-powered study companion and syllabus tracker built specifically for Indian 11th/12th standard students preparing for competitive exams (JEE, KCET, NEET) and Board exams.

Rather than tracking progress linearly, StudyOS models how student learning actually happens: **following multiple coaching lecturers at different paces, across different subjects.**

This project was built for the **Mesh API Hackathon** to demonstrate dynamic, context-aware, multi-model routing.

---

## ⚡ The Problem & The Insight

1. **The Teacher-Pacing Problem**: In Indian coaching institutes (Allen, Fitjee, Akash, etc.), a student might follow one lecturer for Organic Chemistry, another for Inorganic Chemistry, and a third for Physics. Standard edtech apps track syllabus generic-first. StudyOS tracks progress **per lecturer**, mapping covered topics to NCERT standards.
2. **The Cold-Start Spaced Repetition**: Standard flashcard apps require users to manually create decks, which busy students don't have time for. In StudyOS, logging a class session with a low understanding score **immediately seeds the Revision Hub queue** with AI-generated flashcards, vivas, and formulas.
3. **Multi-Model Specialty**: Math, Physics, and Chemistry require different cognitive strengths. Juggling them through a single model is inefficient. StudyOS routes queries to different foundation models depending on the subject, making the routing visibly interactive.

---

## 🚀 Key Features

* **Lecturer-Centric Study Graph**: Add your lecturers, log daily class topics, and track syllabus coverage per teacher.
* **Auto-Populating Spaced Repetition**: Low understanding scores automatically queue revision requirements (Flashcards, Viva QA, Formula cheatsheets).
* **Multi-Model AI Tutor (Mesh API)**: A real-time, LaTeX-capable chatbot with retrieval-augmented generation (RAG) over uploaded lecture notes and learning memories.
* **V2 Layered Memory System**: Asynchronous reflection workers analyze chat histories to capture conceptual mistakes, learning preferences, and temporary goals into a vector-searchable memory table.

---

## 🔗 Mesh API Integration

Every AI interaction in StudyOS routes through **Mesh API** to leverage its multi-model capabilities and unified embeddings gateway:

1. **Embeddings Gateway**: Notes uploads and memory chunks are vectorized using Mesh's `openai/text-embedding-3-small` model for semantic retrieval.
2. **Subject-Based LLM Routing**: In the AI Tutor, prompts are analyzed and routed to the most qualified model for the subject:
   * 📐 **Mathematics** ➔ `anthropic/claude-3-5-sonnet` (superior LaTeX rendering, step-by-step proofs).
   * ⚡ **Physics** ➔ `openai/gpt-4o` (formula manipulation, mechanical logic).
   * 🧪 **Chemistry** ➔ `google/gemini-1.5-pro` (organic naming conventions, factual retrieval).
3. **Visible Model Routing Badges**: The client UI displays an explicit badge on every response showing which model was routed through Mesh: `Mesh: Claude 3.5 Sonnet`, `Mesh: GPT-4o`, `Mesh: Gemini 1.5 Pro`.

---

## 🎯 How to Evaluate (For Hackathon Judges)

To evaluate the complete end-to-end user flow without starting from a blank state:

1. **Sign Up / Log In**: Register a new account or log in.
2. **Seed Demo Data (Crucial)**:
   * Navigate to **Settings** (bottom left / menu).
   * Click **✨ Seed Account** under the **Populate Demo Data** section.
   * This clears the empty state and populates your account with 4 realistic study logs, active lecturer tracks, recent mock tests, and a pre-seeded chat history.
3. **Inspect the AI Tutor**:
   * Open the **AI Tutor** page and click **History** in the top right.
   * Load the seeded chat `"Kirchhoff's Laws & Aldol Condensation"`.
   * **Observe the model routing badges** at the top of each assistant message: KVL was answered by `GPT-4o`, Aldol mechanism by `Gemini 1.5 Pro`, and vector cross product by `Claude 3.5 Sonnet`.
4. **Inspect the Revision Hub**:
   * Open the **Revision Hub**.
   * Note how the queue is seeded with topics from your logged sessions.
   * Choose a topic (e.g., *Aldol Condensation*) and switch between **Flashcards**, **Viva**, and **Formulas** modes to see live-generated study aids.
5. **Test Cold-Start Mitigation**:
   * Go to **Log Class** and log a Physics session with an understanding score of `2` (poor).
   * Go to the **Revision Hub** and note that the topic is now immediately at the top of your revision queue.
