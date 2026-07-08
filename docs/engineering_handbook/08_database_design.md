# 08 - Database Design

## 1. Purpose
Define the data structures required to support the Multi-Layer Memory System and the Retrieval Engine. The database must handle relational data, vector embeddings, and eventually graph relationships.

## 2. Core Schemas (PostgreSQL / Supabase)

### 2.1 Users & Identity
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT,
    exam_priority TEXT,
    created_at TIMESTAMP
);

CREATE TABLE user_preferences (
    user_id UUID REFERENCES users(id),
    explanation_style TEXT,
    preferred_language TEXT,
    detail_level TEXT
);
```

### 2.2 Academic Graph (Relational representation)
```sql
CREATE TABLE subjects (
    id UUID PRIMARY KEY,
    name TEXT
);

CREATE TABLE chapters (
    id UUID PRIMARY KEY,
    subject_id UUID REFERENCES subjects(id),
    name TEXT,
    sequence_order INT
);

CREATE TABLE concepts (
    id UUID PRIMARY KEY,
    chapter_id UUID REFERENCES chapters(id),
    name TEXT
);
```

### 2.3 Memory & Events (Vector + Relational)
```sql
-- Requires pgvector extension
CREATE TABLE memories (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    memory_type TEXT, -- 'mistake', 'insight', 'lecture_note'
    content TEXT,
    embedding VECTOR(1536), -- Assuming OpenAI text-embedding-3-small
    concept_id UUID REFERENCES concepts(id),
    confidence_score FLOAT,
    created_at TIMESTAMP,
    expires_at TIMESTAMP -- For working memory
);
```

## 3. Tool Registry Integration
The Database must support the Tool Registry (e.g., `Search Notes`, `Search Mistakes`) by exposing optimized views or Edge Functions that query these tables efficiently.

## 4. Implementation Guidance
- Enable Row Level Security (RLS) on all tables, ensuring `user_id = auth.uid()`.
- Create HNSW indexes on the `embedding` column for fast vector retrieval.

## 5. Acceptance Criteria
- [ ] Database schema successfully supports all memory layers defined in the Memory Architecture.
- [ ] RLS policies strictly isolate user data.

## 6. Risks
- **Schema Migration**: Migrating from the existing StudyOS V1 single `learning_memory` table to this complex relational structure requires careful data transformation.

## 7. Future Extension Points
- Native Graph Database integration (e.g., Neo4j) if recursive SQL queries on concept dependencies become a bottleneck.
