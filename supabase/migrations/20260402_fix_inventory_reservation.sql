-- =====================================================
-- FIX: INVENTORY RESERVATION AT CHECKOUT
-- =====================================================

CREATE OR REPLACE FUNCTION public.deduct_inventory_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
    -- CASE A: RESERVE stock when order enters checkout pipeline
    IF (
        (TG_OP = 'INSERT' AND NEW.status IN ('confirmed', 'pending_payment'))
        OR
        (TG_OP = 'UPDATE'
         AND NEW.status IN ('confirmed', 'pending_payment')
         AND OLD.status IS DISTINCT FROM NEW.status
         AND OLD.status NOT IN ('confirmed', 'pending_payment', 'packed',
                                'ready_for_pickup', 'rider_assigned',
                                'driver_arrived_warehouse', 'order_picked_up',
                                'dispatched', 'out_for_delivery', 'delivered'))
    ) THEN
        UPDATE public.inventory i
        SET available_stock = GREATEST(0, i.available_stock - oi.item_count)
        FROM (
            SELECT product_id, size, COUNT(*) AS item_count
            FROM public.order_items
            WHERE order_id = NEW.id
            GROUP BY product_id, size
        ) oi
        WHERE i.product_id = oi.product_id
          AND i.size = oi.size;

        IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
            INSERT INTO public.warehouse_activity_log (
                action, entity_type, entity_id, actor_id, details
            ) VALUES (
                'inventory_reserved',
                'order',
                NEW.id,
                COALESCE(NEW.rider_id, '00000000-0000-0000-0000-000000000000'::UUID),
                jsonb_build_object('status', NEW.status, 'trigger_op', TG_OP)
            );
        END IF;
    END IF;

    -- CASE B: RELEASE stock when order is cancelled
    IF (
        TG_OP = 'UPDATE'
        AND NEW.status = 'cancelled'
        AND OLD.status IS DISTINCT FROM 'cancelled'
        AND OLD.status IN ('pending_payment', 'confirmed', 'packed',
                           'ready_for_pickup', 'rider_assigned')
    ) THEN
        UPDATE public.inventory i
        SET available_stock = LEAST(i.total_stock, i.available_stock + oi.item_count)
        FROM (
            SELECT product_id, size, COUNT(*) AS item_count
            FROM public.order_items
            WHERE order_id = NEW.id
            GROUP BY product_id, size
        ) oi
        WHERE i.product_id = oi.product_id
          AND i.size = oi.size;

        IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
            INSERT INTO public.warehouse_activity_log (
                action, entity_type, entity_id, actor_id, details
            ) VALUES (
                'inventory_released',
                'order',
                NEW.id,
                COALESCE(NEW.rider_id, '00000000-0000-0000-0000-000000000000'::UUID),
                jsonb_build_object('old_status', OLD.status, 'new_status', 'cancelled')
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop old trigger and recreate to fire on INSERT too
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_dispatch ON public.orders;

CREATE TRIGGER trg_deduct_inventory_on_dispatch
    AFTER INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.deduct_inventory_on_dispatch();

-- 3. Safety: Auto-cancel stale pending_payment orders after 15 minutes
-- This prevents abandoned checkouts from locking inventory forever.
-- Requires pg_cron extension (available on Supabase Pro plans).
-- If pg_cron is not available, this will silently skip.
DO $inner$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'cancel_stale_pending_orders',
            '*/5 * * * *',  -- every 5 minutes
            'UPDATE public.orders SET status = ''cancelled'' WHERE status = ''pending_payment'' AND created_at < NOW() - INTERVAL ''15 minutes'''
        );
        RAISE NOTICE 'pg_cron job scheduled: cancel_stale_pending_orders';
    ELSE
        RAISE NOTICE 'pg_cron not available — skipping auto-cancel job';
    END IF;
END $inner$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
