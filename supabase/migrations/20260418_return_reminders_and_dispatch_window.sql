-- =============================================================================
-- 1. Add notification_key column for robust dedup of scheduled notifications
-- =============================================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_key TEXT;

-- Unique partial index: at most one notification per key
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_key_unique
  ON public.notifications (notification_key)
  WHERE notification_key IS NOT NULL;

-- =============================================================================
-- 2. Replace auto_dispatch_pre_scheduled_returns with 30-minute window
--    Preserves LEFT JOIN + auto-create logic from 20260402_fix migration
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auto_dispatch_pre_scheduled_returns()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dispatched_count INTEGER := 0;
    v_order RECORD;
    v_pickup_ts TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_return_request_id UUID;
BEGIN
    -- LEFT JOIN so we also pick up orders that have no return_request row yet
    -- (checkout-scheduled returns only have return_pickup_date/return_time_slot on orders)
    FOR v_order IN
        SELECT o.id,
               o.user_id,
               o.delivery_address_id,
               o.return_pickup_date,
               o.return_time_slot,
               rr.id AS return_request_id,
               rr.status AS rr_status
        FROM public.orders o
        LEFT JOIN public.return_requests rr
            ON rr.order_id = o.id
        WHERE o.status IN ('delivered', 'in_use')
          AND o.return_pickup_date IS NOT NULL
          AND o.return_time_slot IS NOT NULL
          -- Either has an approved return_request (with no return rider), OR has no return_request at all
          AND (rr.id IS NULL OR (rr.status = 'approved' AND rr.rider_id IS NULL))
    LOOP
        BEGIN
            v_pickup_ts := (
                v_order.return_pickup_date::TEXT || ' ' || v_order.return_time_slot
            )::TIMESTAMP AT TIME ZONE 'Asia/Kolkata';
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;

        -- Changed from 60 minutes to 30 minutes
        IF v_pickup_ts <= v_now + INTERVAL '30 minutes' AND v_pickup_ts >= v_now - INTERVAL '30 minutes' THEN

            -- Auto-create return_request if none exists (checkout-scheduled returns)
            IF v_order.return_request_id IS NULL THEN
                INSERT INTO public.return_requests (
                    order_id,
                    reason,
                    pickup_address_id,
                    pickup_slot,
                    status,
                    approved_at
                ) VALUES (
                    v_order.id,
                    'pre_scheduled',
                    v_order.delivery_address_id,
                    v_pickup_ts,
                    'approved',
                    v_now
                )
                ON CONFLICT (order_id) DO UPDATE SET
                    status = 'approved',
                    approved_at = v_now
                RETURNING id INTO v_return_request_id;
            ELSE
                v_return_request_id := v_order.return_request_id;
            END IF;

            UPDATE public.orders
            SET status = 'return_scheduled',
                rider_id = NULL,
                updated_at = NOW()
            WHERE id = v_order.id
              AND status IN ('delivered', 'in_use');

            IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
                INSERT INTO public.warehouse_activity_log (
                    action, entity_type, entity_id, actor_id, details
                ) VALUES (
                    'auto_dispatch_return',
                    'order',
                    v_order.id,
                    NULL,
                    jsonb_build_object(
                        'pickup_time', v_pickup_ts,
                        'dispatched_at', v_now,
                        'return_request_id', v_return_request_id,
                        'auto_created_request', v_order.return_request_id IS NULL
                    )
                );
            END IF;

            v_dispatched_count := v_dispatched_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'dispatched_count', v_dispatched_count,
        'checked_at', v_now
    );
END;
$$;
