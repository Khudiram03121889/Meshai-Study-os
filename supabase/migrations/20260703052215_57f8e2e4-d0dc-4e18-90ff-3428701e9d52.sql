
CREATE TABLE public.study_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('prelearn','learn')),
  topic_name TEXT NOT NULL,
  chapter_name TEXT,
  subject_name TEXT,
  subject_id TEXT,
  chapter_id TEXT,
  topic_id TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_documents TO authenticated;
GRANT ALL ON public.study_documents TO service_role;

ALTER TABLE public.study_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own study documents"
  ON public.study_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX study_documents_user_mode_idx ON public.study_documents(user_id, mode, created_at DESC);
