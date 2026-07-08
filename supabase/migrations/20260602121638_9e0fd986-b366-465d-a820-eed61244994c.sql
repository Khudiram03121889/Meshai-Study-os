
REVOKE EXECUTE ON FUNCTION public.match_note_chunks(vector, uuid, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_note_chunks(vector, uuid, integer, text, uuid) TO authenticated, service_role;
