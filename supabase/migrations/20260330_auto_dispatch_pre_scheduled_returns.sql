-- Auto-dispatch pre-scheduled returns to riders
-- This function finds orders that:
--   1) Are currently delivered/in_use
--   2) Have a pre-scheduled return (return_pickup_date + return_time_slot set at checkout)
--   3) Have an approved return_request
--   4) Pickup time is within the next 60 minutes
-- It transitions them to 'return_scheduled', which triggers the existing
-- broadcast_order_to_riders trigger to notify all available riders.

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
BEGIN
    -- Find orders with pre-scheduled returns that are ready to dispatch
    FOR v_order IN
        SELECT o.id, o.return_pickup_date, o.return_time_slot, rr.id AS return_request_id
        FROM public.orders o
        INNER JOIN public.return_requests rr
            ON rr.order_id = o.id
            AND rr.status = 'approved'
        WHERE o.status IN ('delivered', 'in_use')
          AND o.return_pickup_date IS NOT NULL
          AND o.return_time_slot IS NOT NULL
          AND o.rider_id IS NULL
    LOOP
        -- Build the full pickup timestamp from date + time slot
        -- return_time_slot is stored as "HH:MI AM/PM" format
        BEGIN
            v_pickup_ts := (
                v_order.return_pickup_date::TEXT || ' ' || v_order.return_time_slot
            )::TIMESTAMP AT TIME ZONE 'Asia/Kolkata';
        EXCEPTION WHEN OTHERS THEN
            -- Skip if we can't parse the timestamp
            CONTINUE;
        END;

        -- Dispatch if pickup is within the next 60 minutes
        -- (i.e., riders get notified 1 hour before the scheduled pickup)
        IF v_pickup_ts <= v_now + INTERVAL '60 minutes' AND v_pickup_ts >= v_now - INTERVAL '30 minutes' THEN
            -- Transition order to return_scheduled
            -- This triggers broadcast_order_to_riders automatically
            UPDATE public.orders
            SET status = 'return_scheduled',
                updated_at = NOW()
            WHERE id = v_order.id
              AND status IN ('delivered', 'in_use');

            -- Log the auto-dispatch
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
                        'return_request_id', v_order.return_request_id
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

GRANT EXECUTE ON FUNCTION public.auto_dispatch_pre_scheduled_returns() TO service_role;

-- Also allow warehouse/admin to manually trigger auto-dispatch
GRANT EXECUTE ON FUNCTION public.auto_dispatch_pre_scheduled_returns() TO authenticated;
