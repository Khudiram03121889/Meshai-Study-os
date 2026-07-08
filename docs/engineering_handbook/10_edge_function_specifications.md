# 10 - Edge Function Specifications

## 1. Purpose
To maintain a responsive UI, the core AI orchestration (Planner, Context Engine, Reflection) must run on lightweight edge infrastructure. This document specifies the required Edge Functions.

## 2. Function Definitions

### `ai-chat-handler`
- **Purpose**: The main entry point for user AI requests.
- **Workflow**: Invokes the Planner, Context Engine, and GPT model. Streams the response back to the client.
- **Trigger**: HTTP POST `/functions/v1/ai-chat-handler`

### `ai-reflection-worker`
- **Purpose**: Runs asynchronously after `ai-chat-handler` completes. Extracts insights and updates the Vector Database.
- **Trigger**: Internal Event Bus or Background Task.

### `document-processor`
- **Purpose**: Handles uploaded PDFs/Images, performs OCR, chunks text, and generates embeddings for the Vector DB.
- **Trigger**: Supabase Storage upload trigger.

## 3. Implementation Guidance
- Use **Deno** (Supabase Edge Functions) or **Cloudflare Workers**.
- Keep functions stateless. Rely entirely on the Database and Context Engine for state.
- Implement strict timeout handling and fallback responses if the LLM API degrades.

## 4. Acceptance Criteria
- [ ] Chat handler responds with a Time-To-First-Token (TTFT) of under 2 seconds.
- [ ] Reflection worker runs successfully without blocking the main chat UI.

## 5. Risks
- **Cold Starts**: Edge functions might suffer from cold starts if not invoked frequently. Consider keep-alive cron jobs.

## 6. Future Extension Points
- WebAssembly (Wasm) modules within Edge Functions for blazing-fast local token counting (e.g., `tiktoken` in Wasm).
