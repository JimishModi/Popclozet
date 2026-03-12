-- =========================================================================
-- QUICK FIX: FORCE POSTGREST SCHEMA CACHE RELOAD
-- =========================================================================

-- The PGRST204 error "Could not find the 'status' column of 'riders'" 
-- means the database table exists, but the API cache hasn't noticed it yet.
-- Running this simple command instantly refreshes the cache.

NOTIFY pgrst, 'reload schema';
