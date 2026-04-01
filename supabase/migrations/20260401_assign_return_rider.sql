-- ============================================================
-- RPC: assign_return_rider
-- Assigns a rider to a return pickup, transitions order to
-- 'return_dispatched', generates a 6-digit OTP, and logs
-- the activity to the warehouse.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_return_rider(
    p_order_id UUID,
    p_rider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_order RECORD;
    v_otp TEXT;
BEGIN
    -- Auth check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- Lock and fetch order
    SELECT id, user_id, status, rider_id
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Ownership check
    IF v_order.user_id <> v_user_id THEN
        RAISE EXCEPTION 'You can only manage your own orders'
            USING ERRCODE = '42501';
    END IF;

    -- Status check — must be return_scheduled
    IF v_order.status <> 'return_scheduled' THEN
        RAISE EXCEPTION 'Rider can only be assigned when return is scheduled (current status: %)', v_order.status
            USING ERRCODE = '23514';
    END IF;

    -- Generate 6-digit OTP
    v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    -- Update order: assign rider, dispatch, set OTP
    UPDATE public.orders
    SET rider_id = p_rider_id,
        status = 'return_dispatched',
        otp_return = v_otp,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Update return_requests table
    UPDATE public.return_requests
    SET rider_id = p_rider_id,
        status = 'approved'
    WHERE order_id = p_order_id;

    -- Log activity
    IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'return_rider_assigned',
            'order',
            p_order_id,
            v_user_id,
            jsonb_build_object(
                'rider_id', p_rider_id,
                'otp_generated', TRUE
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'orderId', p_order_id,
        'riderId', p_rider_id,
        'otp', v_otp,
        'status', 'return_dispatched'
    );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.assign_return_rider(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_return_rider(UUID, UUID) TO service_role;
