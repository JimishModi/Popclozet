CREATE OR REPLACE FUNCTION public.receive_return_at_warehouse(
    p_order_id UUID,
    p_actor_id UUID,
    p_otp TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_request RECORD;
    v_rider_earning NUMERIC := 0;
BEGIN
    IF p_actor_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = p_actor_id
          AND role IN ('warehouse', 'admin')
    ) THEN
        RAISE EXCEPTION 'Only warehouse staff can receive returns'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_order.status <> 'return_at_warehouse' THEN
        RAISE EXCEPTION 'Rider must drop off the return first (current status: %)', v_order.status
            USING ERRCODE = '23514';
    END IF;

    IF p_otp IS NULL OR TRIM(p_otp) = '' THEN
        RAISE EXCEPTION 'OTP is required to receive returns'
            USING ERRCODE = '23514';
    END IF;

    IF v_order.warehouse_otp_used = TRUE THEN
        RAISE EXCEPTION 'OTP has already been used'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.orders
    SET warehouse_otp_attempts = COALESCE(warehouse_otp_attempts, 0) + 1
    WHERE id = p_order_id;

    IF COALESCE(v_order.warehouse_otp_attempts, 0) >= 5 THEN
        RAISE EXCEPTION 'Too many OTP attempts. Ask the rider to regenerate.'
            USING ERRCODE = '23514';
    END IF;

    IF v_order.warehouse_otp IS NULL OR v_order.warehouse_otp <> p_otp THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Invalid OTP code'
        );
    END IF;

    SELECT *
    INTO v_request
    FROM public.return_requests
    WHERE order_id = p_order_id
    FOR UPDATE;

    UPDATE public.orders
    SET status = 'returned',
        warehouse_otp_used = TRUE,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF v_request.id IS NOT NULL THEN
        UPDATE public.return_requests
        SET status = 'completed',
            completed_at = NOW(),
            received_at = NOW()
        WHERE id = v_request.id;
    END IF;

    IF to_regclass('public.wallets') IS NOT NULL
       AND to_regclass('public.rider_transactions') IS NOT NULL
       AND v_order.rider_id IS NOT NULL THEN
        v_rider_earning := GREATEST(COALESCE(v_order.delivery_fee, 0), 40);

        INSERT INTO public.wallets (user_id, rider_id)
        VALUES (v_order.rider_id, v_order.rider_id)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.rider_transactions (
            rider_id, order_id, type, amount, description
        ) VALUES (
            v_order.rider_id,
            p_order_id,
            'earning',
            v_rider_earning,
            'Scheduled return completed at warehouse'
        );

        UPDATE public.wallets
        SET balance = COALESCE(balance, 0) + v_rider_earning
        WHERE user_id = v_order.rider_id;
    END IF;

    IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action, entity_type, entity_id, actor_id, details
        ) VALUES (
            'receive_return_at_warehouse',
            'order',
            p_order_id,
            p_actor_id,
            jsonb_build_object('rider_id', v_order.rider_id)
        );
    END IF;

    PERFORM public.refresh_return_completion_for_order(p_order_id);

    RETURN jsonb_build_object(
        'success', TRUE,
        'orderId', p_order_id,
        'status', (
            SELECT status
            FROM public.orders
            WHERE id = p_order_id
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_return_at_warehouse(UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
