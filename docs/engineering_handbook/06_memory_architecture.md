# 06 - Memory Architecture

## 1. Purpose
Transition StudyOS from a single `learning_memory` concept to a robust, hierarchical Multi-Layer Memory System. This ensures that the AI can recall everything from deep-seated learning preferences to the context of the current conversation.

## 2. Memory Hierarchy

### 2.1 Identity Memory
- Subjects enrolled.
- Lecturers for each subject.
- Exam priorities (Boards, KCET, JEE).

### 2.2 Academic Profile
- Preference Memory (explanation style, language, detail level, quiz style).
- Academic Memory (strong/weak topics, concept mastery, confidence trends).

### 2.3 Event-Based Memories
- **Lecture Memory**: Timeline, continuity, missed lectures, notes uploaded.
- **Mistake Memory**: Incorrect concepts, repeated errors, misconceptions, confidence changes.
- **Revision Memory**: Revision history, spaced repetition schedule, retention estimates.

### 2.4 Short-Term & Meta Memories
- **Working Memory**: Current conversation, temporary context, active goals.
- **Reflection Memory**: Insights extracted after interactions, new preferences learned, behavior changes.

## 3. Rules & Policies
Each memory type must define:
- **Update rules**: How and when it is updated (e.g., via the Reflection Layer).
- **Retrieval rules**: When the Context Engine should fetch it.
- **Confidence scores**: How certain the system is about this memory.
- **Expiration policies**: When temporary context should be discarded.
- **Consolidation strategy**: How Working Memory graduates into Academic Memory over time.

## 4. Implementation Guidance
- Store structured properties (Identity, Preferences) in a relational database (Supabase PostgreSQL).
- Store unstructured/narrative memories (Insights, Misconceptions) in a Vector DB with robust metadata tagging.

## 5. Acceptance Criteria
- [ ] System automatically categorizes extracted insights into the correct memory tier.
- [ ] Working memory decays or is consolidated at the end of a session.

## 6. Risks
- **Memory Conflicts**: Conflicting insights extracted from different sessions need a resolution mechanism (e.g., timestamping or confidence weighting).

## 7. Future Extension Points
- User-facing memory dashboard where students can view and manually edit what the AI "knows" about them.
