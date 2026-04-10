-- Migration: COD payment must be collected before OTP is shown
--
-- Problem: For "Pay on Delivery" (COD) orders, the delivery OTP was shown
--          immediately on the tracking page. The rider could hand over the
--          package without payment being collected first.
--
-- Fix:     Add a cod_payment_collected flag. The OTP is only generated
--          (written to otp_delivery) AFTER the customer confirms payment
--          via the confirm_cod_payment RPC. For online-paid orders nothing changes.

-- 1. Add the flag column (default FALSE for COD, NULL for non-COD)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cod_payment_collected BOOLEAN DEFAULT FALSE;

-- Back-fill: mark all non-COD orders and already-delivered COD orders as collected
UPDATE public.orders
SET cod_payment_collected = TRUE
WHERE payment_method != 'cod'
   OR status IN ('delivered', 'completed', 'returned', 'return_picked_up', 'return_completed');

-- 2. RPC: Customer confirms COD payment was made (cash or UPI at door).
--    This generates the delivery OTP so the customer can share it with the rider.
CREATE OR REPLACE FUNCTION public.confirm_cod_payment(
    p_order_id UUID,
    p_payment_mode TEXT DEFAULT 'cash'   -- 'cash' | 'upi'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id    UUID := auth.uid();
    v_order      RECORD;
    v_new_otp    TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'UNAUTHENTICATED',
            'message', 'You must be signed in');
    END IF;

    -- Lock the row
    SELECT id, user_id, status, payment_method, cod_payment_collected, otp_delivery
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'NOT_FOUND',
            'message', 'Order not found');
    END IF;

    -- Ownership check
    IF v_order.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'FORBIDDEN',
            'message', 'This order does not belong to you');
    END IF;

    -- Must be a COD order
    IF v_order.payment_method != 'cod' THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'NOT_COD',
            'message', 'This order was not placed with Pay on Delivery');
    END IF;

    -- Must be in a delivery-in-progress status
    IF v_order.status NOT IN (
        'dispatched', 'out_for_delivery', 'order_picked_up',
        'driver_arrived_warehouse', 'ready_for_pickup', 'rider_assigned',
        'confirmed', 'packed'
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'code', 'INVALID_STATE',
            'message', format('Cannot collect payment in status: %s', v_order.status));
    END IF;

    -- Idempotent: if already collected, just return the existing OTP
    IF v_order.cod_payment_collected = TRUE AND v_order.otp_delivery IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'otp', v_order.otp_delivery,
            'already_collected', TRUE
        );
    END IF;

    -- Generate a new 4-digit OTP
    v_new_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- Mark payment collected and set OTP
    UPDATE public.orders
    SET cod_payment_collected = TRUE,
        otp_delivery = v_new_otp,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'otp', v_new_otp,
        'payment_mode', p_payment_mode,
        'already_collected', FALSE
    );
END;
$$;

-- 3. For COD orders, do NOT generate OTP in claim_order anymore.
--    We override resend_order_otp so it skips COD orders where payment is not yet collected.
CREATE OR REPLACE FUNCTION public.resend_order_otp(
    p_order_id UUID,
    p_otp_type TEXT
)
RETURNS VOID AS $$
DECLARE
    v_new_otp TEXT;
    v_payment_method TEXT;
    v_cod_collected BOOLEAN;
BEGIN
    -- For delivery OTPs on COD orders, skip if payment not collected
    IF p_otp_type = 'delivery' THEN
        SELECT payment_method, cod_payment_collected
        INTO v_payment_method, v_cod_collected
        FROM public.orders WHERE id = p_order_id;

        IF v_payment_method = 'cod' AND (v_cod_collected IS NULL OR v_cod_collected = FALSE) THEN
            -- Don't generate OTP yet — customer must pay first
            RETURN;
        END IF;
    END IF;

    -- Generate new 4-digit OTP
    v_new_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    IF p_otp_type = 'delivery' THEN
        UPDATE orders
        SET otp_delivery = v_new_otp,
            updated_at = NOW()
        WHERE id = p_order_id;
    ELSIF p_otp_type = 'return' THEN
        UPDATE orders
        SET otp_return = v_new_otp,
            updated_at = NOW()
        WHERE id = p_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update verify_payment_and_update to handle COD UPI payments at delivery.
--    For COD orders already in delivery, we don't change the order status —
--    we just record the payment and mark cod_payment_collected = TRUE + generate OTP.
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
        'confirmed', 'packed', 'ready_for_pickup', 'rider_assigned',
        'driver_arrived_warehouse', 'order_picked_up',
        'dispatched', 'out_for_delivery'
    ];
BEGIN
    SELECT id, user_id, status, total_amount, razorpay_order_id, order_type, payment_method
    INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Order not found');
    END IF;

    -- Idempotent: already processed (non-COD)
    IF v_order.payment_method != 'cod'
       AND v_order.status IN ('confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered') THEN
        RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
    END IF;

    -- COD order being paid via UPI at delivery time
    IF v_order.payment_method = 'cod' AND v_order.status = ANY(v_cod_delivery_states) THEN
        -- Don't change order status — just record payment + mark collected + generate OTP
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

    -- Standard checkout payment flow
    IF v_order.status NOT IN ('pending', 'pending_payment') THEN
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

EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION verify_payment_and_update FROM PUBLIC;
REVOKE ALL ON FUNCTION verify_payment_and_update FROM authenticated;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.confirm_cod_payment(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
