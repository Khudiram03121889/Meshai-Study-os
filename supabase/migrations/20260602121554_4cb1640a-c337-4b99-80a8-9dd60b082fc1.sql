
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- LECTURERS
-- =====================================================
CREATE TABLE public.lecturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecturers TO authenticated;
GRANT ALL ON public.lecturers TO service_role;
ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lecturers" ON public.lecturers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- CLASS SESSIONS
-- =====================================================
CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id text NOT NULL,
  chapter_id text,
  lecturer_id uuid REFERENCES public.lecturers(id) ON DELETE SET NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  summary text,
  continuity_context text,
  previous_session_id uuid REFERENCES public.class_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_sessions_user_date_idx ON public.class_sessions(user_id, session_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own class_sessions" ON public.class_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- NOTES (uploaded PDFs)
-- =====================================================
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_session_id uuid REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  pdf_url text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  extracted_text text,
  ai_summary text,
  detected_topics jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | ready | failed
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_user_session_idx ON public.notes(user_id, class_session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- NOTE CHUNKS (vector embeddings)
-- =====================================================
CREATE TABLE public.note_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  class_session_id uuid REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  subject_id text,
  lecturer_id uuid,
  chunk_index integer NOT NULL,
  page_number integer,
  topic text,
  chunk_text text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX note_chunks_user_idx ON public.note_chunks(user_id);
CREATE INDEX note_chunks_note_idx ON public.note_chunks(note_id);
CREATE INDEX note_chunks_embedding_idx ON public.note_chunks
  USING hnsw (embedding vector_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_chunks TO authenticated;
GRANT ALL ON public.note_chunks TO service_role;
ALTER TABLE public.note_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own note_chunks" ON public.note_chunks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- AI CHAT HISTORY (per-note + global)
-- =====================================================
CREATE TABLE public.ai_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'global', -- 'global' | 'note' | 'session'
  note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE,
  class_session_id uuid REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'user' | 'assistant'
  message text NOT NULL,
  related_subject text,
  related_topic text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_chat_history_user_idx ON public.ai_chat_history(user_id, created_at DESC);
CREATE INDEX ai_chat_history_note_idx ON public.ai_chat_history(note_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_history TO authenticated;
GRANT ALL ON public.ai_chat_history TO service_role;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_chat_history" ON public.ai_chat_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- LEARNING MEMORY
-- =====================================================
CREATE TABLE public.learning_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id text,
  topic text NOT NULL,
  memory_type text NOT NULL, -- weak_area | mastered | confusion | important_formula | revision_pending | exam_repeated
  confidence_score double precision DEFAULT 0.5,
  notes text,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX learning_memory_user_idx ON public.learning_memory(user_id, memory_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_memory TO authenticated;
GRANT ALL ON public.learning_memory TO service_role;
ALTER TABLE public.learning_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own learning_memory" ON public.learning_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- TEST PAPERS
-- =====================================================
CREATE TABLE public.test_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id text,
  exam_date date,
  title text NOT NULL,
  pdf_url text,
  storage_path text,
  extracted_text text,
  ai_analysis text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_papers TO authenticated;
GRANT ALL ON public.test_papers TO service_role;
ALTER TABLE public.test_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own test_papers" ON public.test_papers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_paper_id uuid NOT NULL REFERENCES public.test_papers(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  topic text,
  difficulty text,
  marks integer,
  repeated_frequency integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX test_questions_user_idx ON public.test_questions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_questions TO authenticated;
GRANT ALL ON public.test_questions TO service_role;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own test_questions" ON public.test_questions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- REVISION TRACKER
-- =====================================================
CREATE TABLE public.revision_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id text,
  topic text NOT NULL,
  revision_count integer DEFAULT 0,
  last_revised timestamptz,
  confidence_level double precision DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX revision_tracker_user_idx ON public.revision_tracker(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revision_tracker TO authenticated;
GRANT ALL ON public.revision_tracker TO service_role;
ALTER TABLE public.revision_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own revision_tracker" ON public.revision_tracker FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- AI GENERATED CONTENT
-- =====================================================
CREATE TABLE public.ai_generated_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE,
  content_type text NOT NULL, -- flashcards | quiz | viva | summary | mcq
  generated_content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_generated_content_user_idx ON public.ai_generated_content(user_id, content_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_content TO authenticated;
GRANT ALL ON public.ai_generated_content TO service_role;
ALTER TABLE public.ai_generated_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_generated_content" ON public.ai_generated_content FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- SEMANTIC SEARCH FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.match_note_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer DEFAULT 8,
  filter_subject text DEFAULT NULL,
  filter_note_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  note_id uuid,
  chunk_text text,
  topic text,
  page_number integer,
  similarity double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    nc.id,
    nc.note_id,
    nc.chunk_text,
    nc.topic,
    nc.page_number,
    1 - (nc.embedding <=> query_embedding) AS similarity
  FROM public.note_chunks nc
  WHERE nc.user_id = match_user_id
    AND (filter_subject IS NULL OR nc.subject_id = filter_subject)
    AND (filter_note_id IS NULL OR nc.note_id = filter_note_id)
    AND nc.embedding IS NOT NULL
  ORDER BY nc.embedding <=> query_embedding
  LIMIT match_count;
$$;
