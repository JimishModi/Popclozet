-- Fix auto_dispatch_pre_scheduled_returns to handle checkout-scheduled returns
--
-- Problem: The original function uses INNER JOIN return_requests, but the checkout
-- flow (CheckoutReturnSchedulePage) only writes return_pickup_date and return_time_slot
-- to the orders table — it never creates a return_requests row. So the INNER JOIN
-- always fails for checkout-scheduled returns and no riders are ever notified.
--
-- Solution: Use LEFT JOIN and handle both cases:
--   1) Orders WITH an approved return_request (from ScheduleReturnPage)
--   2) Orders WITHOUT a return_request but WITH return_pickup_date/return_time_slot
--      set at checkout — auto-create an approved return_request row, then dispatch.

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
    -- Find orders with pre-scheduled returns that are ready to dispatch.
    -- LEFT JOIN so we also pick up orders that have no return_request row yet.
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
          AND o.rider_id IS NULL
          -- Either has an approved return_request, OR has no return_request at all
          -- (checkout-scheduled). Exclude rows with a non-approved return_request.
          AND (rr.id IS NULL OR rr.status = 'approved')
    LOOP
        -- Build the full pickup timestamp from date + time slot
        BEGIN
            v_pickup_ts := (
                v_order.return_pickup_date::TEXT || ' ' || v_order.return_time_slot
            )::TIMESTAMP AT TIME ZONE 'Asia/Kolkata';
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;

        -- Dispatch if pickup is within the next 60 minutes
        IF v_pickup_ts <= v_now + INTERVAL '60 minutes' AND v_pickup_ts >= v_now - INTERVAL '30 minutes' THEN

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

GRANT EXECUTE ON FUNCTION public.auto_dispatch_pre_scheduled_returns() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_dispatch_pre_scheduled_returns() TO authenticated;
