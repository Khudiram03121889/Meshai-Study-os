-- =====================================================
-- Drop legacy V1 memory tables replaced by V2 memories
-- =====================================================
DROP TABLE IF EXISTS public.learning_memory CASCADE;
DROP TABLE IF EXISTS public.revision_tracker CASCADE;
