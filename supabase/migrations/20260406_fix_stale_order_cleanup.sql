-- Fix stale pending_payment order cleanup to not cancel orders where
-- Razorpay has already captured payment (webhook will confirm them).
--
-- Previous cron (in 20260402_fix_inventory_reservation.sql) blindly cancelled
-- ALL pending_payment orders after 15 min — this could cancel orders where
-- money was deducted but the client went offline before verification.
--
-- New behavior:
-- - Wait 30 min (not 15) to give the Razorpay webhook time to confirm
-- - Skip orders that already have a payment record (money was captured)
-- - Only cancel truly abandoned orders (no payment ever completed)

DO $inner$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove the old blind cancellation job
        PERFORM cron.unschedule('cancel_stale_pending_orders');

        -- Schedule the safer replacement
        PERFORM cron.schedule(
            'cancel_stale_pending_orders_v2',
            '*/5 * * * *',  -- every 5 minutes
            $$
                UPDATE public.orders
                SET status = 'cancelled', updated_at = NOW()
                WHERE status = 'pending_payment'
                  AND created_at < NOW() - INTERVAL '30 minutes'
                  AND id NOT IN (
                      SELECT order_id FROM public.payments
                      WHERE razorpay_payment_id IS NOT NULL
                  )
            $$
        );
        RAISE NOTICE 'pg_cron job scheduled: cancel_stale_pending_orders_v2 (safer, 30 min, skips paid)';
    ELSE
        RAISE NOTICE 'pg_cron not available — skipping auto-cancel job update';
    END IF;
END $inner$;

NOTIFY pgrst, 'reload schema';
