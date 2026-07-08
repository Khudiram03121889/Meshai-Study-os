
-- 1. Lock down SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.match_note_chunks(vector, uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_note_chunks(vector, uuid, integer, text, uuid) TO service_role;

-- 2. Move vector extension to dedicated schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION vector SET SCHEMA extensions;

-- Recreate the function so it can still find the vector type via search_path
CREATE OR REPLACE FUNCTION public.match_note_chunks(
  query_embedding extensions.vector,
  match_user_id uuid,
  match_count integer DEFAULT 8,
  filter_subject text DEFAULT NULL::text,
  filter_note_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, note_id uuid, chunk_text text, topic text, page_number integer, similarity double precision)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;
REVOKE EXECUTE ON FUNCTION public.match_note_chunks(extensions.vector, uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_note_chunks(extensions.vector, uuid, integer, text, uuid) TO service_role;

-- 3. Realtime messages RLS: restrict channel access to topics that include the user's own id
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth users own realtime topics select" ON realtime.messages;
DROP POLICY IF EXISTS "auth users own realtime topics insert" ON realtime.messages;

CREATE POLICY "auth users own realtime topics select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

CREATE POLICY "auth users own realtime topics insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);
