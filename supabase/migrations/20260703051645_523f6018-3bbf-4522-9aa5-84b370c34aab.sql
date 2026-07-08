
-- Fix function_search_path_mutable on get_mesh_key
CREATE OR REPLACE FUNCTION public.get_mesh_key()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public, extensions
AS $function$
  SELECT decrypted_secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'MESH_API_KEY' 
  LIMIT 1;
$function$;

-- Lock down SECURITY DEFINER functions to service_role only where possible.
-- These are only invoked from edge functions (which use service_role).
REVOKE EXECUTE ON FUNCTION public.match_memories(extensions.vector, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories(extensions.vector, uuid, integer, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_memories() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_memories() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cache() TO service_role;

-- get_mesh_key and match_note_chunks are called from the authenticated client.
-- Revoke from anon/PUBLIC; keep authenticated (required by app).
REVOKE EXECUTE ON FUNCTION public.get_mesh_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mesh_key() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.match_note_chunks(extensions.vector, uuid, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_note_chunks(extensions.vector, uuid, integer, text, uuid) TO authenticated, service_role;
