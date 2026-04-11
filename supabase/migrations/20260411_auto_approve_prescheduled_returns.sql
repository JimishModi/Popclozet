-- Migration: auto_approve_prescheduled_returns.sql

CREATE OR REPLACE FUNCTION public.schedule_order_return(
    p_order_id uuid,
    p_pickup_address_id uuid,
    p_pickup_slot timestamp with time zone,
    p_reason text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_order RECORD;
    v_return_request_id UUID;
    v_reason TEXT := NULLIF(TRIM(COALESCE(p_reason, 'scheduled_return')), '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF p_pickup_slot IS NULL THEN
        RAISE EXCEPTION 'A pickup slot is required'
            USING ERRCODE = '23502';
    END IF;

    SELECT id, user_id, status
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_order.user_id <> v_user_id THEN
        RAISE EXCEPTION 'You can only schedule returns for your own orders'
            USING ERRCODE = '42501';
    END IF;

    IF v_order.status NOT IN ('delivered', 'in_use') THEN
        RAISE EXCEPTION 'Returns can only be scheduled once an order is delivered and active'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.addresses
        WHERE id = p_pickup_address_id
          AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Pickup address does not belong to the current user'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.return_requests (
        order_id,
        reason,
        pickup_address_id,
        pickup_slot,
        status,
        rider_id,
        pickup_eta,
        approved_at,
        picked_up_at,
        completed_at,
        received_at
    ) VALUES (
        p_order_id,
        COALESCE(v_reason, 'scheduled_return'),
        p_pickup_address_id,
        p_pickup_slot,
        'approved', -- Auto-approve scheduled returns
        NULL,
        NULL,
        NOW(), -- Set approved_at
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (order_id) DO UPDATE SET
        reason = EXCLUDED.reason,
        pickup_address_id = EXCLUDED.pickup_address_id,
        pickup_slot = EXCLUDED.pickup_slot,
        status = 'approved',
        rider_id = NULL,
        pickup_eta = NULL,
        approved_at = NOW(),
        picked_up_at = NULL,
        completed_at = NULL,
        received_at = NULL
    RETURNING id INTO v_return_request_id;

    UPDATE public.orders
    SET status = 'return_scheduled',
        lifecycle_state = 'return_scheduled',
        return_pickup_date = (p_pickup_slot AT TIME ZONE 'Asia/Kolkata')::DATE,
        return_time_slot = to_char(
            p_pickup_slot AT TIME ZONE 'Asia/Kolkata',
            'HH12:MI AM'
        ),
        otp_return = NULL,
        rider_id = NULL,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'schedule_return_auto_approved',
            'order',
            p_order_id,
            v_user_id,
            jsonb_build_object(
                'pickup_address_id', p_pickup_address_id,
                'pickup_slot', p_pickup_slot,
                'auto_approved', true
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'requestId', v_return_request_id,
        'orderId', p_order_id,
        'status', 'return_scheduled'
    );
END;
$$;
