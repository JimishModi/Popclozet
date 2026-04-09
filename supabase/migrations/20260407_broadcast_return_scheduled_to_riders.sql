-- =====================================================
-- FIX: broadcast_order_to_riders must also fire for
-- return_scheduled status, not just ready_for_pickup.
--
-- Problem: auto_dispatch_pre_scheduled_returns() sets
-- order status to 'return_scheduled', but the broadcast
-- trigger only checks for 'ready_for_pickup'. So riders
-- never get rider_notifications rows for return pickups
-- and only see them via slow polling fallback.
--
-- Solution: Add return_scheduled to the trigger condition.
-- =====================================================

CREATE OR REPLACE FUNCTION public.broadcast_order_to_riders()
RETURNS TRIGGER AS $$
BEGIN
    -- Fire for new delivery orders (ready_for_pickup) AND return pickups (return_scheduled)
    IF (
        (OLD.status IS DISTINCT FROM 'ready_for_pickup' AND NEW.status = 'ready_for_pickup')
        OR
        (OLD.status IS DISTINCT FROM 'return_scheduled' AND NEW.status = 'return_scheduled')
    ) AND NEW.rider_id IS NULL THEN
        -- Insert a notification for every rider who is active,
        -- hasn't canceled this order, AND hasn't already declined it.
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS tr_broadcast_order_to_riders ON public.orders;
CREATE TRIGGER tr_broadcast_order_to_riders
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_order_to_riders();

NOTIFY pgrst, 'reload schema';
