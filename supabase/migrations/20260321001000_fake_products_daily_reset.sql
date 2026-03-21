-- =============================================================================
-- Daily reset for fake_products rotation counters
-- =============================================================================
-- Resets show_count → 0 and last_shown_at → epoch each midnight UTC so that:
--   1. The LRU order is levelled at the start of each day.
--   2. show_count remains a meaningful "shown today" metric rather than a
--      monotonically growing number.
--
-- Requires: pg_cron extension
--   Enable in Supabase Dashboard → Database → Extensions → pg_cron
--   (or run: CREATE EXTENSION IF NOT EXISTS pg_cron;)
--
-- The DO block is guarded so that this migration is a safe no-op when pg_cron
-- is not yet enabled. Re-run the schedule call manually once you enable it.
--
-- Alternative (no pg_cron):
--   Deploy a Supabase Edge Function with the cron trigger below and run:
--     UPDATE public.fake_products
--     SET show_count = 0, last_shown_at = '1970-01-01 00:00:00+00'
--     WHERE is_active = true;
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- cron.schedule is idempotent by job name: re-running this migration
    -- updates an existing job rather than creating a duplicate.
    PERFORM cron.schedule(
      'reset-fake-product-rotation',        -- unique job name
      '0 0 * * *',                          -- every day at 00:00 UTC
      $sql$
        UPDATE public.fake_products
        SET
          show_count    = 0,
          last_shown_at = '1970-01-01 00:00:00+00'::TIMESTAMPTZ
        WHERE is_active = true;
      $sql$
    );

    RAISE NOTICE 'pg_cron job "reset-fake-product-rotation" scheduled successfully.';
  ELSE
    RAISE NOTICE 'pg_cron not enabled — skipping cron schedule. '
                 'Enable the extension and re-run this migration, or set up '
                 'an Edge Function cron to reset fake_products daily.';
  END IF;
END $$;
