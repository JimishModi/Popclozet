-- =====================================================
-- FIX: claim_order must not create delivery_tracking rows
-- without coordinates.
--
-- Problem:
-- delivery_tracking.current_lat/current_lng are NOT NULL,
-- but claim_order inserted only order_id/driver_name/is_active.
-- That raises a database error and surfaces as a Supabase RPC 400
-- when riders accept normal delivery orders.
--
-- The rider app already creates the tracking row with real GPS
-- coordinates in apps/rider-app/src/services/trackingService.ts
-- once navigation starts, so the eager insert here is redundant.
-- =====================================================

CREATE OR REPLACE FUNCTION public.claim_order(
    p_order_id UUID,
    p_rider_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_current_status TEXT;
    v_order_rider_id UUID;
BEGIN
    SELECT status, rider_id
    INTO v_current_status, v_order_rider_id
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order does not exist');
    END IF;

    IF v_current_status NOT IN ('ready_for_pickup', 'return_scheduled') THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order is not available to claim');
    END IF;

    IF v_order_rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order already claimed by another rider');
    END IF;

    IF v_current_status = 'return_scheduled' THEN
        UPDATE public.orders
        SET rider_id = p_rider_id,
            status = 'return_dispatched',
            updated_at = NOW()
        WHERE id = p_order_id;

        IF to_regclass('public.return_requests') IS NOT NULL THEN
            UPDATE public.return_requests
            SET status = 'dispatched',
                rider_id = p_rider_id
            WHERE order_id = p_order_id
              AND status IN ('approved', 'dispatched');
        END IF;

        PERFORM public.resend_order_otp(p_order_id, 'return');
    ELSE
        UPDATE public.orders
        SET rider_id = p_rider_id,
            status = 'driver_arrived_warehouse',
            updated_at = NOW()
        WHERE id = p_order_id;
    END IF;

    DELETE FROM public.rider_notifications
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', CASE
            WHEN v_current_status = 'return_scheduled' THEN 'return_dispatched'
            ELSE 'driver_arrived_warehouse'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
