# 15 - Migration Plan

## 1. Purpose
Safely transition existing users and data from StudyOS V1 (which relied on a single `learning_memory` concept) to the complex, Multi-Layer Memory System of V2 without data loss or service interruption.

## 2. Migration Phases

### Phase 1: Dual Write
- Implement V2 database schemas alongside V1 schemas.
- Update V1 backend to write to both the old `learning_memory` table and the new V2 `memories` and `events` tables.
- **Goal**: Build up the V2 data structure seamlessly in the background.

### Phase 2: Historical Data ETL (Extract, Transform, Load)
- Write an asynchronous script to parse all old `learning_memory` rows.
- Use an LLM to categorize the unstructured V1 memories into V2's specific tiers (Mistake, Preference, Academic).
- Generate embeddings for these historical memories using the new pipeline.

### Phase 3: Shadow Routing
- Route a percentage of incoming chat requests to the new V2 Edge Functions.
- Compare the V2 LLM response quality to V1.
- *Note: V2 responses will not be shown to users yet, only logged.*

### Phase 4: Full Cutover
- Switch client traffic entirely to V2 APIs.
- Deprecate V1 writing.
- Keep V1 read APIs active for 30 days as a rollback contingency.

## 3. Implementation Guidance
- Use Supabase Database Webhooks to trigger the dual-write logic without changing legacy client code immediately.
- The ETL script must be highly resumable in case of rate limits from the embedding provider.

## 4. Acceptance Criteria
- [ ] Zero data loss during the transition.
- [ ] Historical user memories are correctly mapped to the new V2 schema.

## 5. Risks
- **ETL Hallucination**: The LLM classifying historical data might miscategorize a preference as a mistake. Manual spot-checking of the ETL output is required.

## 6. Future Extension Points
- Automated data pruning tools for cleaning up legacy schemas post-migration.
