-- =====================================================
-- Fix: Sync return_requests.status with order status
-- =====================================================
-- The return_requests table has its own status enum
-- ('requested','approved','assigned','picked_up','completed','cancelled')
-- but previously nothing updated it beyond 'approved'.
-- This trigger keeps it in sync whenever orders.status changes.

CREATE OR REPLACE FUNCTION public.sync_return_request_status_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_rr_status TEXT;
BEGIN
    -- Map order status → return_request status
    v_new_rr_status := CASE NEW.status
        WHEN 'return_dispatched'   THEN 'assigned'
        WHEN 'return_picked_up'    THEN 'picked_up'
        WHEN 'return_at_warehouse' THEN 'picked_up'   -- still picked_up, awaiting warehouse receipt
        WHEN 'returned'            THEN 'completed'
        WHEN 'return_completed'    THEN 'completed'
        ELSE NULL
    END;

    -- Only act when status actually changed and we have a mapping
    IF NEW.status IS DISTINCT FROM OLD.status AND v_new_rr_status IS NOT NULL THEN
        UPDATE public.return_requests
        SET
            status       = v_new_rr_status,
            -- Stamp the appropriate timestamp column
            picked_up_at = CASE
                WHEN v_new_rr_status = 'picked_up' AND picked_up_at IS NULL
                THEN NOW()
                ELSE picked_up_at
            END,
            completed_at = CASE
                WHEN v_new_rr_status = 'completed' AND completed_at IS NULL
                THEN NOW()
                ELSE completed_at
            END
        WHERE order_id = NEW.id
          -- Never downgrade a status (e.g. don't go back to 'assigned' if already 'completed')
          AND status NOT IN ('completed', 'cancelled');
    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing trigger if present, then recreate
DROP TRIGGER IF EXISTS trg_sync_return_request_on_order_update ON public.orders;

CREATE TRIGGER trg_sync_return_request_on_order_update
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_return_request_status_from_order();


-- =====================================================
-- Fix: Escalation for unclaimed return dispatches
-- =====================================================
-- Call this via pg_cron or the warehouse "manual trigger" button.
-- Returns a list of orders that have been sitting in return_scheduled
-- for > 30 minutes with no rider assigned, so warehouse staff can
-- manually intervene (call the customer, re-broadcast, etc.).

CREATE OR REPLACE FUNCTION public.escalate_unclaimed_return_dispatches()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now        TIMESTAMPTZ := NOW();
    v_stale_mins INTEGER     := 30;  -- alert after 30 min unclaimed
    v_escalated  JSONB[]     := '{}';
    v_order      RECORD;
BEGIN
    FOR v_order IN
        SELECT
            o.id,
            o.return_pickup_date,
            o.return_time_slot,
            o.updated_at,
            rr.id AS return_request_id
        FROM public.orders o
        INNER JOIN public.return_requests rr
            ON rr.order_id = o.id
           AND rr.status   = 'approved'
        WHERE o.status    = 'return_scheduled'
          AND o.rider_id  IS NULL
          AND o.updated_at < v_now - (v_stale_mins || ' minutes')::INTERVAL
    LOOP
        -- Log to warehouse_activity_log so the warehouse dashboard can surface it
        IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
            INSERT INTO public.warehouse_activity_log (
                action, entity_type, entity_id, actor_id, details
            ) VALUES (
                'escalate_unclaimed_return',
                'order',
                v_order.id,
                NULL,
                jsonb_build_object(
                    'return_request_id', v_order.return_request_id,
                    'dispatched_at',     v_order.updated_at,
                    'stale_minutes',     v_stale_mins,
                    'escalated_at',      v_now
                )
            )
            -- Skip duplicate escalations logged in the last 30 min
            ON CONFLICT DO NOTHING;
        END IF;

        v_escalated := array_append(
            v_escalated,
            jsonb_build_object(
                'order_id',           v_order.id,
                'return_request_id',  v_order.return_request_id,
                'dispatched_at',      v_order.updated_at,
                'stale_minutes',      EXTRACT(EPOCH FROM (v_now - v_order.updated_at)) / 60
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success',          TRUE,
        'escalated_count',  array_length(v_escalated, 1),
        'orders',           to_jsonb(v_escalated),
        'checked_at',       v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalate_unclaimed_return_dispatches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_unclaimed_return_dispatches() TO service_role;


-- =====================================================
-- Patch auto_dispatch to also call escalation
-- =====================================================
-- Extend auto_dispatch_pre_scheduled_returns so that each run also
-- surfaces any orders stuck without a rider for > 30 min.
-- The result JSON now includes an 'escalated' key.

CREATE OR REPLACE FUNCTION public.auto_dispatch_pre_scheduled_returns()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dispatched_count INTEGER := 0;
    v_order            RECORD;
    v_pickup_ts        TIMESTAMPTZ;
    v_now              TIMESTAMPTZ := NOW();
    v_escalation_result JSONB;
BEGIN
    -- ── 1. Dispatch orders whose pickup window is within the next 60 minutes ──
    FOR v_order IN
        SELECT o.id, o.return_pickup_date, o.return_time_slot, rr.id AS return_request_id
        FROM public.orders o
        INNER JOIN public.return_requests rr
            ON rr.order_id = o.id
           AND rr.status   = 'approved'
        WHERE o.status IN ('delivered', 'in_use')
          AND o.return_pickup_date IS NOT NULL
          AND o.return_time_slot   IS NOT NULL
          AND o.rider_id IS NULL
    LOOP
        BEGIN
            v_pickup_ts := (
                v_order.return_pickup_date::TEXT || ' ' || v_order.return_time_slot
            )::TIMESTAMP AT TIME ZONE 'Asia/Kolkata';
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;

        IF v_pickup_ts <= v_now + INTERVAL '60 minutes'
           AND v_pickup_ts >= v_now - INTERVAL '30 minutes'
        THEN
            UPDATE public.orders
            SET status     = 'return_scheduled',
                updated_at = NOW()
            WHERE id     = v_order.id
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
                        'pickup_time',       v_pickup_ts,
                        'dispatched_at',     v_now,
                        'return_request_id', v_order.return_request_id
                    )
                );
            END IF;

            v_dispatched_count := v_dispatched_count + 1;
        END IF;
    END LOOP;

    -- ── 2. Escalate returns stuck in return_scheduled with no rider ──
    SELECT public.escalate_unclaimed_return_dispatches()
    INTO v_escalation_result;

    RETURN jsonb_build_object(
        'success',          TRUE,
        'dispatched_count', v_dispatched_count,
        'checked_at',       v_now,
        'escalated',        v_escalation_result
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_dispatch_pre_scheduled_returns() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_dispatch_pre_scheduled_returns() TO authenticated;
