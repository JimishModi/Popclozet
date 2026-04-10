CREATE OR REPLACE FUNCTION public.verify_payment_and_update(
    p_order_id UUID,
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT,
    p_provider TEXT DEFAULT 'razorpay'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_new_status TEXT;
    v_new_otp TEXT;
    v_cod_delivery_states TEXT[] := ARRAY[
        'order_picked_up',
        'dispatched',
        'out_for_delivery'
    ];
BEGIN
    SELECT id, user_id, status, total_amount, razorpay_order_id, order_type, payment_method
    INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Order not found');
    END IF;

    IF v_order.payment_method != 'cod'
       AND v_order.status IN ('confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered') THEN
        RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
    END IF;

    IF v_order.payment_method = 'cod' AND v_order.status = ANY(v_cod_delivery_states) THEN
        v_new_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

        UPDATE orders
        SET cod_payment_collected = TRUE,
            otp_delivery = v_new_otp,
            razorpay_order_id = p_razorpay_order_id,
            updated_at = NOW()
        WHERE id = p_order_id;

        INSERT INTO payments (
            user_id, order_id, amount, status, provider,
            razorpay_payment_id, razorpay_order_id
        ) VALUES (
            v_order.user_id, p_order_id, v_order.total_amount, 'completed',
            p_provider, p_razorpay_payment_id, p_razorpay_order_id
        );

        RETURN jsonb_build_object(
            'success', true, 'order_id', p_order_id,
            'new_status', v_order.status, 'payment_id', p_razorpay_payment_id,
            'cod_payment_collected', true
        );
    END IF;

    IF v_order.status NOT IN ('pending', 'pending_payment', 'payment_failed') THEN
        RETURN jsonb_build_object(
            'success', false, 'code', 'INVALID_STATE',
            'message', format('Cannot verify payment for order in state: %s', v_order.status)
        );
    END IF;

    v_new_status := CASE WHEN v_order.order_type = 'buyout' THEN 'completed' ELSE 'confirmed' END;

    UPDATE orders
    SET status = v_new_status,
        razorpay_order_id = p_razorpay_order_id,
        updated_at = NOW()
    WHERE id = p_order_id;

    INSERT INTO payments (
        user_id, order_id, amount, status, provider,
        razorpay_payment_id, razorpay_order_id
    ) VALUES (
        v_order.user_id, p_order_id, v_order.total_amount, 'completed',
        p_provider, p_razorpay_payment_id, p_razorpay_order_id
    );

    RETURN jsonb_build_object(
        'success', true, 'order_id', p_order_id,
        'new_status', v_new_status, 'payment_id', p_razorpay_payment_id
    );
END;
$$;
