
-- Study logs table
CREATE TABLE public.study_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  lecturer_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  topic_ids JSONB NOT NULL DEFAULT '[]',
  understanding INTEGER NOT NULL DEFAULT 3,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track progress table
CREATE TABLE public.track_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lecturer_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  covered_topic_ids JSONB NOT NULL DEFAULT '[]',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lecturer_id, chapter_id)
);

-- Question attempts table
CREATE TABLE public.question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  mode TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  student_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  mistake_type TEXT,
  explanation TEXT,
  formula_used TEXT,
  time_spent INTEGER,
  exam_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Test results table
CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  score NUMERIC NOT NULL,
  time_taken INTEGER NOT NULL,
  time_allowed INTEGER NOT NULL,
  attempt_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
CREATE POLICY "Users can manage own study_logs" ON public.study_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own track_progress" ON public.track_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own question_attempts" ON public.question_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own test_results" ON public.test_results FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
