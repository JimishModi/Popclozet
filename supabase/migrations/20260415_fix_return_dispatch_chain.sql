-- =============================================================================
-- Fix the T-60 return dispatch chain — three bugs addressed:
--
-- BUG 1: broadcast_order_to_riders lost return_scheduled support
--   20260407_fix_broadcast_respects_declined.sql accidentally overwrote the
--   fix in 20260407_broadcast_return_scheduled_to_riders.sql, leaving the
--   trigger checking only 'ready_for_pickup'. rider_notifications rows were
--   never created for return pickups, so riders never saw the request.
--
-- BUG 2: auto_dispatch_pre_scheduled_returns() was never scheduled
--   The edge function's comment says "Schedule via Supabase Dashboard" — it
--   was never actually scheduled. The only pg_cron job calls notification-webhook
--   which only sends reminders, never dispatches.
--
-- BUG 3: notification-webhook CRON reminder window is fragile
--   The window [now+60, now+75) is only 15 min wide. A cron firing 1 second
--   late misses any pickup at exactly now+60. Also, checkout-scheduled returns
--   have no return_requests row before dispatch, so the query always misses them.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Restore return_scheduled condition in broadcast_order_to_riders
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_order_to_riders()
RETURNS TRIGGER AS $$
BEGIN
    -- Fire for new delivery orders (ready_for_pickup) AND return pickups (return_scheduled)
    IF (
        (OLD.status IS DISTINCT FROM 'ready_for_pickup' AND NEW.status = 'ready_for_pickup')
        OR
        (OLD.status IS DISTINCT FROM 'return_scheduled' AND NEW.status = 'return_scheduled')
    ) AND NEW.rider_id IS NULL THEN
        INSERT INTO public.rider_notifications (order_id, rider_id)
        SELECT NEW.id, p.user_id
        FROM public.profiles p
        WHERE p.role = 'rider'
          -- Exclude riders who released/cancelled this order
          AND NOT EXISTS (
              SELECT 1 FROM public.order_cancellations oc
              WHERE oc.order_id = NEW.id AND oc.rider_id = p.user_id
          )
          -- Exclude riders who already declined this notification
          AND NOT EXISTS (
              SELECT 1 FROM public.rider_notifications rn
              WHERE rn.order_id = NEW.id
                AND rn.rider_id = p.user_id
                AND rn.status = 'declined'
          )
        ON CONFLICT (order_id, rider_id) DO NOTHING;
        -- DO NOTHING preserves any existing declined status
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_broadcast_order_to_riders ON public.orders;
CREATE TRIGGER tr_broadcast_order_to_riders
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_order_to_riders();


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Schedule auto_dispatch_pre_scheduled_returns every 15 minutes
--
-- Runs the DB function directly (no edge function auth header needed).
-- When it transitions an order to return_scheduled:
--   → tr_broadcast_order_to_riders creates rider_notifications rows (Fix 1)
--   → trg_orders_notify_webhook queues an async call to notification-webhook
--   → notification-webhook return_scheduled handler sends:
--       • warehouse push  "✅ Return Approved — Assigning rider"
--       • customer push   "✅ Return Approved"
--       • rider pushes    "New Ride Request!" to all online riders
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    PERFORM cron.unschedule('auto_dispatch_returns_cron');
EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist yet — safe to ignore
    NULL;
END $$;

SELECT cron.schedule(
    'auto_dispatch_returns_cron',
    '*/15 * * * *',
    'SELECT public.auto_dispatch_pre_scheduled_returns()'
);


NOTIFY pgrst, 'reload schema';
