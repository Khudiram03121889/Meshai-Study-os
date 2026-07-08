# 14 - API Contracts

## 1. Purpose
Define the strict JSON contracts between the Client (Web/Mobile) and the Edge Functions.

## 2. Core Endpoints

### 2.1 Chat Endpoint
`POST /api/v2/chat`

**Request:**
```json
{
  "message": "Explain Kirchhoff's Law",
  "conversation_id": "uuid-1234",
  "subject_context": "physics" // Optional
}
```

**Response (Server-Sent Events Stream):**
```json
// Intermediate Planner State
{"type": "planner_status", "content": "Retrieving recent mistakes..."}

// Final Streamed Text
{"type": "text_chunk", "content": "Kirchhoff's"}
{"type": "text_chunk", "content": " Law states that..."}

// Reflection trigger (invisible to user, but returned for client state)
{"type": "reflection_queued", "job_id": "job-5678"}
```

### 2.2 Event Ingestion Endpoint
`POST /api/v2/events`

**Request:**
```json
{
  "event_type": "quiz.completed",
  "payload": {
    "quiz_id": "quiz-999",
    "score": 85,
    "incorrect_concept_ids": ["concept-abc", "concept-xyz"]
  },
  "timestamp": "2026-07-02T10:00:00Z"
}
```

**Response:**
```json
{
  "status": "success",
  "processed": true
}
```

## 3. Implementation Guidance
- Enforce strict typing on the Edge Functions using TypeScript interfaces that mirror these JSON structures.
- Use `zod` for payload validation on all incoming requests.

## 4. Acceptance Criteria
- [ ] The `api/v2/chat` endpoint correctly handles both SSE streaming and error fallback states.
- [ ] Invalid event payloads are rejected with descriptive 400 Bad Request errors.

## 5. Risks
- **Stream Interruptions**: Mobile clients dropping connection during an SSE stream require robust reconnection logic without re-triggering the costly Planner phase.

## 6. Future Extension Points
- GraphQL layer for fetching complex Memory graph dependencies.
