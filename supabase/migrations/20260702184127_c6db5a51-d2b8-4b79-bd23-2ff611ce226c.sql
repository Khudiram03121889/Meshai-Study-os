CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  exam_priority text DEFAULT 'boards',
  explanation_style text DEFAULT 'balanced',
  preferred_language text DEFAULT 'english',
  detail_level text DEFAULT 'medium',
  quiz_style text DEFAULT 'mcq',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user_preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subjects" ON public.subjects FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chapters_subject_idx ON public.chapters(subject_id, sequence_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chapters" ON public.chapters FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  difficulty integer DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS concepts_chapter_idx ON public.concepts(chapter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concepts TO authenticated;
GRANT ALL ON public.concepts TO service_role;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own concepts" ON public.concepts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_type text NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(1536),
  subject_slug text,
  concept_id uuid REFERENCES public.concepts(id) ON DELETE SET NULL,
  confidence_score double precision DEFAULT 0.5,
  frequency_count integer DEFAULT 1,
  source text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS memories_user_type_idx ON public.memories(user_id, memory_type);
CREATE INDEX IF NOT EXISTS memories_user_subject_idx ON public.memories(user_id, subject_slug);
CREATE INDEX IF NOT EXISTS memories_expires_idx ON public.memories(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON public.memories
  USING hnsw (embedding extensions.vector_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories" ON public.memories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_user_type_idx ON public.events(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS events_created_idx ON public.events(created_at DESC);
GRANT SELECT, INSERT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events read" ON public.events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own events insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.semantic_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query_text text NOT NULL,
  query_embedding extensions.vector(1536),
  response_text text NOT NULL,
  intent text,
  memory_version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);
CREATE INDEX IF NOT EXISTS semantic_cache_user_idx ON public.semantic_cache(user_id);
CREATE INDEX IF NOT EXISTS semantic_cache_expires_idx ON public.semantic_cache(expires_at);
CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx ON public.semantic_cache
  USING hnsw (query_embedding extensions.vector_cosine_ops);
GRANT SELECT, INSERT, DELETE ON public.semantic_cache TO authenticated;
GRANT ALL ON public.semantic_cache TO service_role;
ALTER TABLE public.semantic_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own semantic_cache" ON public.semantic_cache FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.planner_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trace_id text NOT NULL,
  intent text,
  intent_confidence double precision,
  planner_decision jsonb,
  tools_called jsonb DEFAULT '[]'::jsonb,
  context_token_budget integer,
  context_tokens_used integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_cost_usd double precision,
  reasoning_model text,
  cache_hit boolean DEFAULT false,
  gateway_latency_ms integer,
  planner_latency_ms integer,
  retrieval_latency_ms integer,
  llm_ttft_ms integer,
  total_latency_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planner_logs_user_idx ON public.planner_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS planner_logs_trace_idx ON public.planner_logs(trace_id);
GRANT INSERT ON public.planner_logs TO authenticated;
GRANT ALL ON public.planner_logs TO service_role;
ALTER TABLE public.planner_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own planner_logs insert" ON public.planner_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own planner_logs read" ON public.planner_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding extensions.vector(1536),
  match_user_id uuid,
  match_count integer DEFAULT 5,
  filter_memory_type text DEFAULT NULL,
  filter_subject text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  memory_type text,
  content text,
  confidence_score double precision,
  subject_slug text,
  metadata jsonb,
  similarity double precision,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    m.id,
    m.memory_type,
    m.content,
    m.confidence_score,
    m.subject_slug,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM public.memories m
  WHERE m.user_id = match_user_id
    AND (filter_memory_type IS NULL OR m.memory_type = filter_memory_type)
    AND (filter_subject IS NULL OR m.subject_slug = filter_subject)
    AND m.embedding IS NOT NULL
    AND (m.expires_at IS NULL OR m.expires_at > now())
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;
REVOKE EXECUTE ON FUNCTION public.match_memories(extensions.vector, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories(extensions.vector, uuid, integer, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_memories()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH deleted AS (
    DELETE FROM public.memories
    WHERE expires_at IS NOT NULL AND expires_at < now()
    RETURNING id
  )
  SELECT count(*)::integer FROM deleted;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_memories() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_memories() TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH deleted AS (
    DELETE FROM public.semantic_cache
    WHERE expires_at < now()
    RETURNING id
  )
  SELECT count(*)::integer FROM deleted;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cache() TO service_role;