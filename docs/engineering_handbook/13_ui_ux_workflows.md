# 13 - UI/UX Workflows

## 1. Purpose
While the backend orchestration is highly complex, the user experience must remain incredibly simple and seamless. This document outlines the core workflows the student will experience in StudyOS V2.

## 2. Core Workflows

### 2.1 The Chat Interface
The primary interface remains a chat window, but it is now augmented by "Context Indicators".
1. **User asks a question**.
2. **UI shows "Thinking..."**.
3. **UI reveals Context Indicators**: While the Planner runs, the UI displays brief non-blocking indicators (e.g., *“Looking at your past mistakes in Physics...”*, *“Reviewing notes from yesterday...”*).
4. **Response is streamed**.

### 2.2 Memory Dashboard (New)
To build trust, students must be able to see and correct what the AI knows about them.
1. **Navigate to "My Study Profile"**.
2. **View Insights**: The student sees auto-generated insights (e.g., *“I notice you struggle with Integration by Parts.”*).
3. **Correction/Confirmation**: The user can delete an insight or confirm it.

### 2.3 Upload Workflow
1. **User uploads a test paper**.
2. **Background Processing**: OCR and event triggers run.
3. **Proactive Notification**: The AI proactively sends a message: *“I've analyzed your recent Math test. Would you like to review the 3 questions you got wrong?”*

## 3. Implementation Guidance
- Context Indicators should be powered by Server-Sent Events (SSE) or WebSockets to stream intermediate states before the final LLM response begins streaming.
- Use Lovable / React components for rapid prototyping of the Memory Dashboard.

## 4. Acceptance Criteria
- [ ] Users can view and delete entries from their Academic Profile.
- [ ] The Chat UI explicitly shows *why* it is giving a specific personalized answer.

## 5. Risks
- **Information Overload**: Showing too many context indicators might confuse the student. Keep them concise.

## 6. Future Extension Points
- Voice interface via WebRTC for real-time tutoring.
