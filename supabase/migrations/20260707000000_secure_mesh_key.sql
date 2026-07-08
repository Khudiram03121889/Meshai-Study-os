-- Revoke execution of get_mesh_key from authenticated and anonymous users
REVOKE EXECUTE ON FUNCTION public.get_mesh_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mesh_key() TO service_role;
