-- ============================================================
-- RPC: request_immediate_return
-- Creates a return request with reason='immediate'.
-- Modified to pend for warehouse approval instead of auto-approving.
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_immediate_return(
    p_order_id UUID,
    p_pickup_address_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_order RECORD;
    v_return_request_id UUID;
BEGIN
    -- Auth check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- Lock and fetch order
    SELECT id, user_id, status, delivery_address_id
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
        RAISE EXCEPTION 'You can only return your own orders'
            USING ERRCODE = '42501';
    END IF;

    -- Status check — only from delivered/in_use
    IF v_order.status NOT IN ('delivered', 'in_use') THEN
        RAISE EXCEPTION 'Returns can only be requested once an order is delivered and active (current status: %)', v_order.status
            USING ERRCODE = '23514';
    END IF;

    -- If no pickup address provided, fall back to the delivery address
    IF p_pickup_address_id IS NULL THEN
        p_pickup_address_id := v_order.delivery_address_id;
    END IF;

    -- Verify address belongs to user (when provided)
    IF p_pickup_address_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.addresses
        WHERE id = p_pickup_address_id
          AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Pickup address does not belong to the current user'
            USING ERRCODE = '42501';
    END IF;

    -- Upsert return request — immediate, but now pending approval
    INSERT INTO public.return_requests (
        order_id,
        reason,
        pickup_address_id,
        pickup_slot,
        status,
        approved_at,
        rider_id,
        pickup_eta,
        picked_up_at,
        completed_at,
        received_at
    ) VALUES (
        p_order_id,
        'immediate',
        p_pickup_address_id,
        NOW(),              -- pickup slot = right now
        'requested',        -- pend for warehouse approval
        NULL,               -- not approved yet
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (order_id) DO UPDATE SET
        reason = 'immediate',
        pickup_address_id = EXCLUDED.pickup_address_id,
        pickup_slot = NOW(),
        status = 'requested',
        approved_at = NULL,
        rider_id = NULL,
        pickup_eta = NULL,
        picked_up_at = NULL,
        completed_at = NULL,
        received_at = NULL
    RETURNING id INTO v_return_request_id;

    -- Transition order to return_requested (waits for warehouse approval)
    UPDATE public.orders
    SET status = 'return_requested',
        return_pickup_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE,
        return_time_slot = 'ASAP',
        otp_return = NULL,
        rider_id = NULL,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Log activity
    IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'immediate_return_requested',
            'order',
            p_order_id,
            v_user_id,
            jsonb_build_object(
                'pickup_address_id', p_pickup_address_id,
                'reason', 'immediate',
                'auto_approved', FALSE
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'requestId', v_return_request_id,
        'orderId', p_order_id,
        'status', 'return_requested'
    );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.request_immediate_return(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_immediate_return(UUID, UUID) TO service_role;
