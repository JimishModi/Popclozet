CREATE OR REPLACE FUNCTION public.release_order(
    p_order_id UUID,
    p_rider_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_order RECORD;
    v_reset_status TEXT;
BEGIN
    SELECT id, rider_id, status
    INTO v_current_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order does not exist');
    END IF;

    IF v_current_order.rider_id <> p_rider_id THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'You cannot release an order you do not own');
    END IF;

    IF v_current_order.status NOT IN ('rider_assigned', 'driver_arrived_warehouse', 'return_dispatched') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'You can only resign before pickup is completed'
        );
    END IF;

    IF to_regclass('public.order_cancellations') IS NOT NULL THEN
        INSERT INTO public.order_cancellations (order_id, rider_id, reason)
        VALUES (p_order_id, p_rider_id, p_reason);
    END IF;

    v_reset_status := CASE
        WHEN v_current_order.status = 'return_dispatched' THEN 'return_scheduled'
        ELSE 'ready_for_pickup'
    END;

    UPDATE public.orders
    SET rider_id = NULL,
        status = v_reset_status,
        claim_attempts = COALESCE(claim_attempts, 0) + 1,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF v_current_order.status = 'return_dispatched'
       AND to_regclass('public.return_requests') IS NOT NULL THEN
        UPDATE public.return_requests
        SET status = 'approved',
            rider_id = NULL,
            pickup_eta = NULL
        WHERE order_id = p_order_id
          AND status IN ('approved', 'dispatched');
    END IF;

    IF to_regclass('public.delivery_tracking') IS NOT NULL THEN
        DELETE FROM public.delivery_tracking
        WHERE order_id = p_order_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', v_reset_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
