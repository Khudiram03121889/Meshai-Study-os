# 19 - AI Runtime Architecture

--------------------------------------------------
## SECTION 1: Purpose

### Why Runtime Architecture Exists
The AI Runtime Architecture is the operational "kernel" of StudyOS V2. While static architecture specifications (like Database Design or UI/UX Workflows) describe *where* components live and *what* they do at rest, the Runtime Architecture defines *how* they breathe, communicate, and react in real-time. In an AI-native operating system, state is continuously mutating. User inputs are unpredictable, external APIs have variable latency, and context is highly dynamic. The Runtime Architecture exists to govern this chaos, ensuring determinism, low latency, and reliability.

### Runtime vs. Static Architecture
Static architecture is the blueprint of a building; runtime architecture is the flow of electricity, water, and people through it. 
- **Static**: "We use Supabase and pgvector."
- **Runtime**: "When the user asks a question, how long do we wait for a vector similarity search before falling back to cached exact matches? How do we stream bytes to the client while still evaluating intent?"

### Why AI Requires Orchestration over Sequential API Calls
Traditional web applications follow linear request-response cycles: `Client -> Controller -> Database -> Response`. 
AI systems, specifically autonomous ones like StudyOS V2, cannot follow this paradigm because the required data is not known at request time. 
Instead of sequential API calls, StudyOS V2 requires **Orchestration**:
- **Non-Determinism**: An LLM may decide it lacks context halfway through generating a response.
- **Dynamic Branching**: If a user asks a simple question, we skip retrieval to save $0.001 in token costs. If they ask a complex diagnostic question, we fork the runtime into 5 parallel searches.
- **Asynchronous Side Effects**: A chat message doesn't just return a string; it mutates long-term memory, triggers spaced repetition updates, and logs analytics.

--------------------------------------------------
## SECTION 2: Runtime Overview

### Complete Runtime Lifecycle

```mermaid
graph TD
    User([User Request]) --> Gateway[API Gateway]
    Gateway --> Auth[Authentication & Rate Limiting]
    Auth --> Intent[Intent Detection Module]
    
    Intent --> Planner[Planner Agent]
    
    Planner --> Graph[Execution Graph Engine]
    
    subgraph Parallel Execution
        Graph --> Tool[Tool Executor]
        Graph --> Retrieval[Retrieval Engine]
    end
    
    Tool --> Context[Context Engine]
    Retrieval --> Context
    
    Context --> Prompt[Prompt Builder]
    Prompt --> Reason[Reasoning Model GPT-4o]
    
    Reason --> Stream[Streaming Service]
    Stream --> User
    
    Reason -.-> Reflection[Reflection Layer Background]
    Reflection -.-> Memory[Memory Update Service]
    Reflection -.-> Analytics[Analytics Engine]
```

### Explanation of Transitions

1. **User → Gateway**: The raw HTTP or WebSocket request is received. The edge intercepts it to ensure minimal geographical latency.
2. **Gateway → Authentication**: JWT verification and rate-limit bucket checking happen in <5ms.
3. **Authentication → Intent Detection**: A sub-100ms classifier (local SLM or heuristic) categorizes the payload.
4. **Intent Detection → Planner**: The orchestrator evaluates the intent to allocate budget and determine required tools.
5. **Planner → Execution Graph**: The Planner compiles a JSON execution plan which is converted into a Directed Acyclic Graph (DAG) for parallel execution.
6. **Execution Graph → Tool/Retrieval**: Independent nodes run concurrently (e.g., fetching mistakes from Postgres while querying a vector database for concepts).
7. **Tool/Retrieval → Context Engine**: Raw outputs are fed into a deduplication and ranking funnel.
8. **Context Engine → Prompt Builder**: Ranked chunks are serialized into a strict Markdown prompt within token limits.
9. **Prompt Builder → Reasoning Model**: The heavy LLM inference begins.
10. **Reasoning Model → Streaming**: Tokens are streamed to the client immediately via Server-Sent Events (SSE).
11. **Reasoning Model → Reflection**: After streaming completes, a background worker consumes the final transcript to extract insights.

--------------------------------------------------
## SECTION 3: Gateway

### Responsibilities
The Gateway is the frontline defense and traffic controller. It runs on Edge infrastructure (e.g., Cloudflare Workers or Supabase Edge Functions) to minimize Time-to-First-Byte (TTFB).

### 1. Authentication
Validates short-lived JWTs. If the token is invalid, execution halts immediately with a `401 Unauthorized`. It injects the `user_id` into the request context, enforcing multitenancy constraints down the stack.

### 2. Rate Limiting
Implements a leaky bucket algorithm using Redis. 
- **Tier 1 (Free)**: 10 requests / minute, 50 / day.
- **Tier 2 (Pro)**: 60 requests / minute, 500 / day.
Exceeding limits triggers a `429 Too Many Requests` with a `Retry-After` header.

### 3. Request Validation
Uses Zod (TypeScript) schemas to ensure payload integrity. Drops malformed requests to prevent prompt injection or SQL injection attacks further down.

### 4. Conversation Lookup & Creation
If a `conversation_id` is provided, the Gateway validates its existence and ownership via a fast Redis cache or Edge DB lookup. If none is provided, it synchronously mints a new UUID and initializes the conversation record.

### 5. Streaming Initialization
Before any AI processing begins, the Gateway opens a Server-Sent Events (SSE) connection and sends a generic `{"status": "processing"}` ping to ensure the TCP connection remains alive during the Planner phase.

### 6. Error Handling & Latency Requirements
- **Max Gateway Overhead**: < 50ms.
- **Failures**: Returns standardized JSON error structures. Never leaks internal stack traces.

### 7. Retry Strategy
The Gateway does not retry user requests internally to avoid thundering herd problems. It relies on the client SDK for exponential backoff retries on network failures (e.g., `502 Bad Gateway`).

--------------------------------------------------
## SECTION 4: Intent Detection

### How Intents are Classified
Intent Detection bypasses slow LLMs. We utilize a fast, quantized local classifier (e.g., ONNX-compiled BERT) or strict RegEx/heuristic trees running directly in the Edge Function to classify the query in under 30ms.

### Intent Hierarchy
1. **Academic Question**
   - 1.1 Conceptual Explanation
   - 1.2 Mathematical Problem Solving
   - 1.3 Fact Retrieval
2. **Diagnostic & Metacognitive**
   - 2.1 Study Strategy Query
   - 2.2 Mistake Analysis
3. **Platform Action**
   - 3.1 Generate Quiz
   - 3.2 Summarize Notes
4. **Conversational**
   - 4.1 Greetings
   - 4.2 Casual Chit-chat

### Examples
- *"What is Newton's third law?"* -> `Academic Question.Fact Retrieval`
- *"Why do I keep failing integration by parts?"* -> `Diagnostic.Mistake Analysis`
- *"Create a 10-question test on Optics."* -> `Platform Action.Generate Quiz`
- *"Hello!"* -> `Conversational.Greetings`

### Output Schema
```json
{
  "intent": "Diagnostic.Mistake Analysis",
  "confidence_score": 0.94,
  "requires_planner": true,
  "suggested_timeout_ms": 5000
}
```

### Confidence Scores & Fallback Logic
If the `confidence_score` is below `0.70`, the system triggers **Fallback Logic**:
- The query is assigned an `Unknown` intent.
- It is routed to a fast LLM (GPT-4o-mini) for a zero-shot intent extraction. 
- If the LLM also fails to classify it, the system defaults to a standard `Academic Question.Conceptual Explanation` to ensure the user still gets a helpful response.

### Unknown Intent Handling
If an intent is completely unparseable (e.g., keyboard mashing like "asdfgh"), the Gateway short-circuits the entire AI lifecycle and immediately returns a fallback standard response: *"I didn't quite catch that. Could you ask your question about your studies again?"* This saves valuable planner and retrieval tokens.


--------------------------------------------------
## SECTION 5: Planner Runtime

### Planner Responsibilities
The Planner is the strategic cortex of the Runtime. It does not answer questions. Its sole responsibility is to draft a structured Execution Plan to acquire the context needed to answer the question optimally, within a defined cost budget.

### Decision Tree & Reasoning Process
The Planner operates via an internal Chain-of-Thought (CoT) before yielding output:
1. **Analyze Constraint**: Does the intent require external memory, or is parametric knowledge sufficient?
2. **Budget Allocation**: Is this a premium user? How complex is the query? Assign a token budget (e.g., 2000 tokens).
3. **Tool Selection**: Based on the query, which registry tools will yield the highest-value context?
4. **Model Routing**: Select the reasoning model capable of handling the final task.

### Structured JSON Output
The Planner must output a strict JSON schema dictating the graph payload.
```json
{
  "execution_graph": [
    {
      "node_id": "search_1",
      "tool": "SearchMistakes",
      "args": {"topic": "Integration", "time_window": "30d"}
    },
    {
      "node_id": "search_2",
      "tool": "SearchLectureTimeline",
      "args": {"subject": "Math"}
    }
  ],
  "reasoning_model": "gpt-4o",
  "context_token_budget": 1500
}
```

### Cost Estimation & Token Budgeting
Before execution, the Planner predicts the maximum possible token cost of the requested tools. If the sum exceeds the `context_token_budget`, the Planner trims low-priority nodes from the Execution Graph before dispatching it. 

### Failure Recovery & Evaluation Metrics
- **Failure**: If the Planner outputs invalid JSON, a fast schema validation catches it and invokes a 1-shot retry. If it fails again, the Runtime defaults to a generic Retrieval Engine query.
- **Evaluation Metric**: "Planner Precision" — measuring the ratio of tools requested vs. tools whose output was actually utilized in the final prompt generation (target > 85%).

--------------------------------------------------
## SECTION 6: Execution Graph

### Replacing Sequential API Calls
Sequential execution (`await search_notes(); await search_tests();`) introduces unacceptable latency. The Execution Graph Engine converts the Planner's JSON output into a Directed Acyclic Graph (DAG) to support massive parallelization.

### Why Graph Execution is Superior
Graph execution allows for **Dependencies** and **Conditional Execution**. If `Node C` (Search Mistake Details) depends on the output of `Node A` (Identify Weak Topics), the graph executor automatically waits for `Node A` to resolve, while simultaneously running `Node B` (Search Lecture Timeline) in parallel.

### Graph Flow Example

```mermaid
graph TD
    Start((Start)) --> NodeA[Tool: Search Weak Topics]
    Start --> NodeB[Tool: Search Lecture Timeline]
    
    NodeA --> Condition{Weakness Found?}
    Condition -->|Yes| NodeC[Tool: Search Mistake Database]
    Condition -->|No| NodeD[Skip Mistake Search]
    
    NodeB --> ContextEngine
    NodeC --> ContextEngine
    NodeD --> ContextEngine
```

### Node Mechanics
- **Parallel Execution**: Any node without dependencies is spawned immediately in an asynchronous thread pool.
- **Retries**: Each node specifies a retry policy (e.g., `max_retries: 2`). If a tool API rate-limits, the graph executor retries that specific node without failing the entire graph.
- **Cancellation**: If a critical node fails and halts graph progression, or if the user disconnects the socket, an `AbortController` signal is propagated to cancel all pending execution nodes instantly to save compute.
- **Dynamic Modification**: Tools themselves can inject new nodes into the graph during runtime. For example, if a search returns a pointer to a specific document, the tool can append a `FetchDocument` node dynamically.

--------------------------------------------------
## SECTION 7: Tool Registry

The Tool Registry is the standard library of StudyOS. Every tool adheres to a strict interface contract.

### Common Tool Specification Template
Every tool definition requires:
- **Purpose**: What the tool does.
- **Inputs/Outputs**: Typed Zod schemas.
- **Permissions**: Required access level (e.g., `Self`, `Teacher`).
- **Latency / Cost**: Expected p95 latency and token cost estimate.
- **Caching**: TTL for caching results.
- **Error Handling / Retries**: Retry limits and fallback defaults.

### Example Tool: `SearchMistakes`
- **Purpose**: Retrieves historical test and quiz mistakes matching a specific concept.
- **Inputs**: `{ "concept": "string", "limit": "integer" }`
- **Outputs**: `Array<{ mistake_text, correct_answer, date }>`
- **Permissions**: `Self` (User can only query their own ID via RLS).
- **Latency**: ~80ms (Indexed Vector Search).
- **Token Cost**: ~100 tokens per returned item.
- **Caching**: 5 minutes (TTL).
- **Retries**: 1 (Transient DB timeouts).

### Core Registry Tools
1. **Search Notes**: Retrieves uploaded OCR/PDF lecture notes.
2. **Search Tests**: Retrieves past examination papers.
3. **Search Formula Database**: Keyword search for mathematical/scientific formulas.
4. **Search Weak Topics**: Queries the Academic Memory graph for nodes with `<60%` mastery.
5. **Search Lecture Timeline**: Retrieves the chronological log of what was taught in class.
6. **Search Academic Memory**: Broad retrieval of user preferences and learning styles.
7. **Search Revision Queue**: Pulls topics due for Spaced Repetition today.
8. **Search Previous Chats**: Semantic search over the Reflection Memory of past sessions.
9. **Search Flashcards**: Retrieves user-generated flashcards for a topic.
10. **Search User Preferences**: Pulls UI/UX and tone preferences.
11. **Search Knowledge Graph**: Traverses concept prerequisites (e.g., "To learn Integration, fetch Differentiation").
12. **Search Study Logs**: Retrieves raw analytics (e.g., "Studied for 4 hours yesterday").
13. **Predict Next Lecture**: Analyzes syllabus progression to guess tomorrow's topic.
14. **Generate Quiz**: Dynamic node that spins up an asynchronous quiz-generation task.
15. **Planner Cache**: Inspects the semantic cache before executing heavy tools.
16. **Memory Search**: General-purpose cross-index search.
17. **Context Compression**: A utility tool to summarize massive documents before passing them forward.

--------------------------------------------------
## SECTION 8: Retrieval Pipeline

### Runtime Retrieval Architecture
When a Tool requests data from the database, it doesn't just execute a `SELECT` statement. It initiates the Retrieval Pipeline.

```mermaid
graph TD
    Planner[Planner Tool Request] --> Meta[Metadata Filters]
    Meta --> Branch{Retrieval Type}
    
    Branch -->|Text| Hybrid[Hybrid Search RRF]
    Branch -->|Concepts| Graph[Knowledge Graph Traversal]
    
    Hybrid --> Vector[Vector Semantic Search]
    
    Vector --> Rank[Ranking Engine]
    Graph --> Rank
    
    Rank --> Dedup[Deduplication]
    Dedup --> Compress[Context Compression]
    Compress --> Assemble[Context Assembly]
    Assemble --> Prompt[Prompt Builder]
```

### Stage Explanations
1. **Metadata Filters**: Pre-filtering the database (e.g., `WHERE subject = 'math' AND user_id = '123'`). This drastically reduces the vector search space, making it exponentially faster.
2. **Hybrid Search**: Combines BM25 (keyword exact match) with Vector similarity to handle acronyms (e.g., "KCL" vs "Kirchhoff's Current Law").
3. **Knowledge Graph**: Explores node edges to pull in prerequisite concepts necessary to understand the retrieved document.
4. **Ranking -> Deduplication -> Compression**: (Detailed in subsequent sections).
5. **Context Assembly**: The raw, optimized chunks are assembled into a coherent JSON array structure ready to be injected into the final LLM prompt.


--------------------------------------------------
## SECTION 9: Ranking Engine

### Purpose
The Retrieval Pipeline often surfaces more documents than the token budget allows. The Ranking Engine is responsible for scoring and sorting these chunks to ensure only the highest-signal context reaches the LLM.

### Ranking Factors
Instead of sorting purely by vector similarity, the Runtime uses a multi-factor weighting algorithm:
- **Semantic Similarity ($S$)**: Standard cosine similarity from the Vector DB (0.0 - 1.0).
- **Topic Relevance ($T$)**: Boolean (1 or 0). Does this chunk belong to the active subject?
- **Recency ($R$)**: Time-decay factor. A mistake made yesterday is more relevant than a mistake made 6 months ago.
- **Confidence ($C$)**: How confident is the system in this memory? (0.0 - 1.0).
- **Importance ($I$)**: A flag set during extraction (e.g., "Core Principle" vs "Trivia").
- **Lecture Order ($L$)**: Sequential boost. If we are discussing Chapter 3, concepts from Chapter 3 get a boost over Chapter 1.
- **Memory Strength ($M$)**: If a user has fully mastered a concept, we deprioritize retrieving basic explanations of it.
- **Repeated Mistakes ($E$)**: A massive boost multiplier if the retrieved chunk is a mistake the user has made >2 times.
- **Revision Priority ($P$)**: Boost if the concept is due for spaced repetition today.
- **Context Diversity ($D$)**: A penalty applied dynamically if the engine has already ranked 3 chunks from the exact same source document.

### Scoring Formula
The final score $F$ for a chunk $k$ is calculated as:

$$F_k = (W_s \cdot S) + (W_t \cdot T) + (W_r \cdot e^{-\lambda t}) + (W_e \cdot E) - (W_d \cdot D)$$

*Where $W$ represents the configurable weight for each factor, adjusted via A/B testing.*

--------------------------------------------------
## SECTION 10: Context Builder

### Responsibilities
The Context Builder converts the ranked, raw data objects into a heavily optimized Markdown string to be injected into the final LLM prompt.

### Budget Allocation & Compression
The Context Builder receives a strict `max_tokens` budget from the Planner (e.g., 2000 tokens). 
1. It loops through the ranked chunks, calculating the token length of each.
2. If adding a chunk exceeds the budget, it triggers **Compression**.
3. **Compression** uses a fast local SLM (or aggressive RegEx) to strip boilerplate, stop-words, and redundant phrasing.
4. If it still exceeds the budget, the chunk is dropped entirely.

### Prompt Ordering & Construction
LLMs suffer from the "Lost in the Middle" phenomenon. The Context Builder structures the prompt strategically:
1. **Top**: Core Identity & Instructions (Highest attention).
2. **Middle**: Ranked retrieved context (Mistakes, Notes, Timeline).
3. **Bottom**: The immediate user query and strict constraints (Highest attention).

### Adaptive Prompt Generation
The builder dynamically changes the prompt template based on the Planner's intent. If the intent is `Diagnostic`, it injects a specific prompt header: `"Analyze the following user mistakes and explain the root cause."` If the intent is `Generate Quiz`, it changes to: `"Generate 5 multiple-choice questions based on the following notes."`

--------------------------------------------------
## SECTION 11: Streaming Runtime

### Streaming Protocol
The AI Runtime must feel instant. We cannot wait 5 seconds for the Planner, Graph, and LLM to finish before sending a response. The Gateway uses **Server-Sent Events (SSE)**.

### Intermediate Planner Events
While the Planner and Graph are executing, the Runtime streams status updates to the client to update the UI "Context Indicators".
```json
data: {"type": "status", "message": "Analyzing intent..."}
data: {"type": "status", "message": "Searching your recent Physics mistakes..."}
data: {"type": "status", "message": "Reading your uploaded notes on Optics..."}
```

### Token Streaming
Once the Reasoning Model begins inference, the Gateway pipes the raw token stream directly to the SSE socket.
```json
data: {"type": "token", "content": "Newton's"}
data: {"type": "token", "content": " Third"}
data: {"type": "token", "content": " Law"}
```

### Recovery After Disconnect
If the user's mobile connection drops mid-stream:
1. The Gateway detects the broken pipe.
2. The Streaming Runtime issues an `AbortController` signal to the OpenAI API, halting token generation and saving costs.
3. The partial transcript is saved to Working Memory.
4. Upon reconnection, the client can fetch the partial message, but the system will *not* auto-resume generation unless explicitly requested.

--------------------------------------------------
## SECTION 12: Reflection Runtime

### Asynchronous Execution
The Reflection Pipeline runs entirely **out-of-band**. It is triggered immediately after the Streaming Runtime closes the connection with the user. The user never waits for Reflection.

### The Reflection Pipeline
1. **Input**: The full transcript of the conversation (User Query + AI Response + Retrieved Context used).
2. **Execution**: A background worker spins up a cheaper model (e.g., GPT-4o-mini).
3. **Insight Extraction**: The model scans the transcript for new knowledge. *"Did the student learn something? Did they reveal a preference?"*
4. **Memory Generation**: If an insight is found, the worker generates a structured JSON memory object.
5. **Updates**:
   - **Preference Updates**: *"User explicitly stated they hate math analogies."* -> Updates Relational DB.
   - **Confidence Updates**: *"User correctly answered a difficult Kirchhoff question."* -> Updates Concept Mastery score in DB.
   - **Revision Generation**: *"User struggled with this."* -> Adds the topic to tomorrow's Spaced Repetition queue.

### Planner Feedback Loop
The Reflection layer also evaluates the Planner. If the AI response reveals that the Planner fetched useless information, the Reflection worker logs a negative reinforcement signal against the Planner's exact decision trace, feeding data into the future fine-tuning pipeline.


--------------------------------------------------
## SECTION 13: Memory Runtime

### The Lifecycle of a Memory
StudyOS V2 relies on a continuously mutating memory state. The Memory Runtime is the subsystem that governs how memories are born, how they age, and how they die.

#### 1. Working Memory Lifecycle
When a user opens a chat, a `Working Memory` object is created in Redis. It holds the past 10 messages and the immediate context. It is incredibly fast but highly volatile.
- **Decay**: If the user is inactive for 2 hours, the Working Memory expires.
- **Promotion**: Before expiration, the `Memory Consolidator` worker evaluates the Working Memory. Important facts (e.g., "I have a math test tomorrow") are promoted to Long-Term Memory. Trivial chat ("Thanks for the help") is pruned.

#### 2. Long-Term Memory Lifecycle
Stored permanently in the Vector DB / Graph DB.
- **Creation**: Triggered by the Reflection Worker or direct user action (uploading a note).
- **Updates & Merging**: If the Reflection Worker extracts "Student struggles with Vectors," but a memory already exists saying "Student finds Vectors difficult," the Memory Runtime merges them, bumping the `confidence_score` and `frequency_count` rather than creating a duplicate row.
- **Conflict Resolution**: If a new memory contradicts an old one (e.g., "User understands Vectors" vs "User struggles with Vectors"), the runtime uses recency weighting. The newer memory overwrites the old one, but the old one is archived for historical analytics.
- **Memory Decay**: Memory strength decays exponentially over time according to the Ebbinghaus forgetting curve. A concept mastered 6 months ago without any recent refresh will have its confidence score artificially lowered during retrieval.

--------------------------------------------------
## SECTION 14: Background Workers

The Runtime relies on a fleet of asynchronous, independent background workers (e.g., deployed as serverless cron jobs or Celery/BullMQ workers) to keep the main thread fast.

### Core Workers
1. **Reflection Worker**
   - *Purpose*: Analyzes chat transcripts post-generation to extract insights.
   - *Trigger*: Event Bus (`chat.completed`).
   - *Retry*: 3 retries with exponential backoff.
2. **Embedding Worker**
   - *Purpose*: Chunks and embeds uploaded PDFs/images via OCR.
   - *Trigger*: Storage webhook (`file.uploaded`).
3. **Memory Consolidator**
   - *Purpose*: Promotes Working Memory to Long-Term Memory; merges duplicate vector entries.
   - *Trigger*: Scheduled (Every 6 hours per active user).
4. **Analytics & Event Aggregator**
   - *Purpose*: Rolls up millions of granular events (`question.answered`) into daily mastery scores.
   - *Trigger*: Scheduled (Nightly).
5. **Revision Scheduler**
   - *Purpose*: Calculates the spaced repetition algorithm to flag concepts for tomorrow's revision queue.
   - *Trigger*: Scheduled (Nightly at 2 AM local time).
6. **Cache Cleaner**
   - *Purpose*: Invalidates stale semantic cache entries.
   - *Trigger*: Scheduled (Hourly).
7. **Planner Trainer**
   - *Purpose*: Aggregates Planner feedback logs and prepares JSONL datasets for periodic LLM fine-tuning.
   - *Trigger*: Scheduled (Weekly).
8. **Knowledge Graph Builder**
   - *Purpose*: Asynchronously maps new concepts extracted from notes into the relational graph structure.
   - *Trigger*: Event Bus (`concept.discovered`).

### Failure Handling
If a worker fails completely, it dumps its payload into a Dead Letter Queue (DLQ). Alerts are fired to Datadog/Sentry, allowing engineers to replay the DLQ manually after patching the bug.

--------------------------------------------------
## SECTION 15: Semantic Cache

### Purpose
To drastically reduce OpenAI API costs and response latency (down to <200ms), the Runtime employs a Semantic Cache via Redis or Supabase edge caching.

### Mechanics
- **Cache Keys**: The cache key is not a simple string match. It is a highly compressed semantic embedding of the user's intent + query.
- **Similarity Thresholds**: If a new query's embedding has a cosine similarity of `> 0.98` to a cached key, it is considered a Cache Hit.
- **Versioning & Invalidation**:
  - *Memory Version*: If a user's Long-Term Memory updates, their personal cache is entirely invalidated. We cannot serve a cached answer that says "You don't know Vectors" if they just mastered Vectors.
  - *Document Version*: If a user uploads a new note, relevant cached answers are invalidated.
  - *Planner Version*: If we update the Planner logic, the global cache is wiped.
- **Cache Warming**: The `Revision Scheduler` predicts what the user is likely to ask tomorrow (e.g., questions about the scheduled revision topics) and pre-computes the answers during off-peak hours, warming the cache.

### Metrics
- Track Cache Hit Ratio. If it falls below 15%, the Similarity Thresholds must be audited.

--------------------------------------------------
## SECTION 16: Observability

### Purpose
In a multi-agent, graph-execution architecture, debugging a single bad response is impossible without flawless telemetry.

### Telemetry Design
Every single request generates a unique `Trace ID` at the Gateway. This ID is passed to the Planner, the Tools, the Context Engine, the LLM, and the Reflection Worker.

### Logged Metrics per Trace
- **Latencies**: Gateway Overhead, Planner Latency, Retrieval Latency (per tool), Context Assembly Latency, LLM TTFT (Time-to-First-Token), Total Generation Time.
- **Data Metrics**: Cache Hit (Boolean), Retrieved Chunks count, Memory Count utilized.
- **Token Metrics**: Prompt Tokens, Completion Tokens, Total Cost (USD).
- **Decisions**: The raw JSON output of the Planner Decision.

### Correlation IDs
If a background worker (like the Embedding Worker) fails, it logs a `Correlation ID` linking back to the original `Trace ID` of the file upload request.

### Dashboard Design
Engineers monitor a unified Datadog/Grafana dashboard tracking:
1. P95 LLM Latency.
2. Planner Error Rate (Schema parsing failures).
3. OpenAI API Cost per hour.
4. Token Waste (Tokens retrieved but dropped by the Context Engine).


--------------------------------------------------
## SECTION 17: Failure Recovery

### The Reality of Orchestration
A multi-agent runtime has exponentially more points of failure than a CRUD app. The system must degrade gracefully.

### Component Failures & Mitigations
1. **Planner Failure (Invalid JSON/Timeout)**
   - *Recovery*: 1 immediate retry. If it fails again, bypass the Planner completely. Fetch the user's basic profile and execute a raw LLM query without advanced context.
2. **Tool/Retrieval Timeout**
   - *Recovery*: The Execution Graph enforces strict timeouts per node (e.g., 800ms). If a vector search takes 900ms, the graph abandons it. The Context Engine simply builds the prompt with whatever chunks successfully resolved in time.
3. **LLM API Timeout / 502 Bad Gateway**
   - *Recovery*: The Gateway catches the OpenAI failure. It instantly routes the request to a Fallback Model (e.g., Anthropic Claude 3 Haiku or Azure OpenAI fallback region).
4. **Streaming Interruption**
   - *Recovery*: Detect TCP socket closure. Issue an `AbortController` signal to the LLM to halt generation and save token costs. Save the partial chunk to Working Memory.
5. **Cache/Memory Corruption**
   - *Recovery*: If the JSON in a memory row fails Zod validation upon retrieval, it is dropped from the current request and flagged for asynchronous quarantine and repair.

### Graceful Degradation
The user must always receive an answer. If all external APIs fail, the Edge function returns a cached fallback response: *"I'm having trouble connecting to my memory banks right now. Could you check your internet connection and try asking again in a moment?"*

--------------------------------------------------
## SECTION 18: Cost Accounting

### Economics of AI Runtimes
LLM API costs can bankrupt a startup if left unchecked. The Runtime enforces strict Cost Accounting at multiple granularities.

### Cost Tracking Granularity
- **Per Request**: The Gateway tallies `(Planner Tokens * Cost) + (Reasoning Tokens * Cost) + (Retrieval DB Compute)`.
- **Per User / Per Conversation**: Rolled up in Supabase Analytics. High-cost users can be identified.
- **Per Study Mode**: E.g., "Mock Test Mode" might cost 5x more than "Casual Chat."

### Budgets & Optimization
- **Daily/Monthly Budgets**: Users are assigned a soft token limit based on their subscription tier. Once the limit is reached, the Model Routing engine quietly downgrades them to a cheaper model (e.g., GPT-4o-mini).
- **Optimization Strategies**: The Context Engine actively tracks "Wasted Tokens"—context that was retrieved, paid for (in compute), but dropped due to budget constraints. High token waste triggers alerts to adjust the Planner's retrieval instructions.

--------------------------------------------------
## SECTION 19: Model Routing

### Abstraction Layer
The Runtime does not bind directly to `openai.chat.completions`. It uses an abstracted `ModelRouter` interface.

### Routing Policies
- **GPT-4o (or equivalent flagship model)**: Used ONLY for highly complex diagnostic reasoning (e.g., *"Why did I fail this physics problem?"*). High token budget.
- **GPT-4o-mini (or Claude 3 Haiku)**: Used for the Planner Agent, Reflection Worker, and basic fact-retrieval questions. 
- **Embeddings**: `text-embedding-3-small` (OpenAI) for cost-effective dense vectors.
- **Future Anthropic / Gemini**: The router supports A/B testing. We can route 10% of users to Claude 3.5 Sonnet to compare TTFT latency and user retention metrics automatically.
- **Cost-Downgrade Routing**: As mentioned in Section 18, heavy users are silently routed to mini models if they exhaust their tier budget.

--------------------------------------------------
## SECTION 20: MCP Compatibility

### Designing for the Model Context Protocol (MCP)
To future-proof StudyOS V2, the Tool Registry and Execution Graph are designed to comply with the Model Context Protocol (MCP). This standardizes how AI agents communicate with data sources and tools.

### Tool Abstraction
Instead of hardcoding database queries into the Planner, tools are exposed as standardized MCP resources. 
- **Internal Tools**: Memory Search, Notes Retrieval.
- **Future External Tools**:
  - *Python Execution*: Allowing the LLM to write and execute a Python script in a secure sandbox to graph a mathematical function for the student.
  - *Web Search*: Querying Tavily/Brave to fetch real-time data for current events (if applicable to the syllabus).
  - *Calendar Integration*: Using a Google Calendar MCP server to schedule study sessions automatically.
  - *Local FileSystem*: (For desktop versions) Scanning local folders for assignments.

### Local Models
By standardizing on MCP, a future local version of StudyOS (running Llama 3 on-device) can seamlessly connect to the exact same cloud tool registry via the standardized protocol without rewriting the execution logic.


--------------------------------------------------
## SECTION 21: Scalability

### Supporting the Growth Curve
The Runtime is stateless at the Edge, pushing all state into highly scalable storage layers.

- **100 Users**: A single Supabase instance handles relational, vector, and auth workloads. Edge functions run in a single region.
- **10,000 Users**:
  - *Horizontal Scaling*: Edge Functions distribute globally via Anycast.
  - *Cache Scaling*: Dedicated Redis cluster deployed for semantic caching to offload the database.
- **100,000 Users**:
  - *Database Scaling*: Read replicas implemented for the Tool Registry to handle massive concurrent `SELECT` queries.
  - *Vector Scaling*: HNSW index parameters (`m`, `ef_construction`) tuned to balance RAM usage and recall speed. Dedicated Pinecone/Weaviate cluster if `pgvector` hits I/O bottlenecks.
  - *Worker Scaling*: Background workers moved to Kubernetes (K8s) or managed queues (AWS SQS / Google Cloud Tasks) auto-scaling based on queue depth (e.g., millions of reflection jobs).

--------------------------------------------------
## SECTION 22: Production Readiness

Before StudyOS V2 accepts live user traffic, the following DevOps/SRE standards are strictly enforced.

### 1. Security & Compliance
- **Secrets Management**: OpenAI/Anthropic API keys stored in HashiCorp Vault or Supabase Vault, injected at runtime.
- **SOC2/FERPA Compliance**: PII anonymization pipelines active before data hits the Reflection Worker.

### 2. Logging & Monitoring
- Unified logging to Datadog. PagerDuty alerts configured for:
  - 5xx Error rates > 1%.
  - LLM API Latency P99 > 3 seconds.
  - Dead Letter Queue depth > 100.

### 3. Disaster Recovery & Backups
- Point-in-Time-Recovery (PITR) enabled on Postgres. Daily snapshots of the Vector DB.

### 4. Deployment & Versioning
- **Blue-Green Deployment**: AI prompt updates are rolled out to a "Green" edge environment and tested against the 500-question Evaluation Suite before traffic is switched.
- **Feature Flags**: Tools and specific LLM routes are wrapped in LaunchDarkly/PostHog feature flags. We can instantly kill a malfunctioning tool without redeploying code.
- **A/B Testing**: The runtime supports routing 5% of traffic to a new Planner prompt version and tracking the downstream "Insight Extraction Rate" to prove empirical improvement.

--------------------------------------------------
## SECTION 23: Acceptance Criteria

The AI Runtime Architecture is considered complete and ready for production when:
- [ ] **Latency**: Median Time-to-First-Token (TTFT) for a generic query is <1.5s.
- [ ] **Cost**: Median cost per chat interaction does not exceed $0.005.
- [ ] **Accuracy**: Planner correctly identifies the intent and selects the necessary tools 95% of the time against the test dataset.
- [ ] **Resilience**: The system gracefully degrades to a fallback model during a simulated OpenAI API outage.
- [ ] **Privacy**: Automated penetration tests confirm users cannot retrieve memories across tenant boundaries.

--------------------------------------------------
## SECTION 24: Appendices

### A. Runtime Glossary
- **DAG**: Directed Acyclic Graph. The execution model for parallel tools.
- **TTFT**: Time-to-First-Token. The critical UX latency metric.
- **RRF**: Reciprocal Rank Fusion. The algorithm used for Hybrid Search.
- **SLM**: Small Language Model (e.g., Llama 3 8B). Used for routing and compression.

### B. Standard Tool JSON Contract
```json
{
  "tool_name": "SearchMistakes",
  "version": "1.2.0",
  "description": "Searches user mistake history.",
  "parameters": {
    "type": "object",
    "properties": {
      "topic": { "type": "string" }
    },
    "required": ["topic"]
  }
}
```

### C. Planner Execution Plan Example
```json
{
  "intent": "Diagnostic",
  "confidence": 0.95,
  "budget": 2000,
  "graph": [
    {"node": "A", "tool": "SearchNotes", "depends_on": []},
    {"node": "B", "tool": "SearchMistakes", "depends_on": ["A"]}
  ]
}
```

*--- End of Document ---*


