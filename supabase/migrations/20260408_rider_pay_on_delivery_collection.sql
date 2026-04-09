ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS rider_collected_payment_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION public.verify_pod_payment_and_update(
  p_order_id UUID,
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_provider TEXT DEFAULT 'razorpay',
  p_actor_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, user_id, rider_id, status, total_amount, payment_method, razorpay_order_id
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'code', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  IF p_actor_id IS NULL OR v_order.rider_id IS NULL OR v_order.rider_id <> p_actor_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'FORBIDDEN',
      'message', 'Only the assigned rider can record delivery payment'
    );
  END IF;

  IF COALESCE(v_order.payment_method, '') <> 'cod' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'INVALID_PAYMENT_METHOD',
      'message', 'Only pay-on-delivery orders can be collected here'
    );
  END IF;

  IF v_order.status NOT IN ('order_picked_up', 'dispatched', 'out_for_delivery', 'delivered') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'INVALID_STATE',
      'message', format('Cannot collect payment for order in state: %s', v_order.status)
    );
  END IF;

  IF v_order.razorpay_order_id IS NOT NULL
     AND v_order.razorpay_order_id <> p_razorpay_order_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'ORDER_MISMATCH',
      'message', 'Razorpay order ID does not match the stored value'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE order_id = p_order_id
      AND status = 'completed'
  ) THEN
    RETURN jsonb_build_object('success', TRUE, 'order_id', p_order_id, 'already_processed', TRUE);
  END IF;

  UPDATE public.orders
  SET razorpay_order_id = p_razorpay_order_id,
      rider_collected_payment_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.payments
  SET status = 'completed',
      provider = p_provider,
      amount = v_order.total_amount,
      user_id = v_order.user_id,
      razorpay_payment_id = p_razorpay_payment_id,
      razorpay_order_id = p_razorpay_order_id
  WHERE order_id = p_order_id
    AND status = 'pending_cod';

  IF NOT EXISTS (
    SELECT 1
    FROM public.payments
    WHERE order_id = p_order_id
      AND status = 'completed'
  ) THEN
    INSERT INTO public.payments (
      user_id,
      order_id,
      amount,
      status,
      provider,
      razorpay_payment_id,
      razorpay_order_id
    ) VALUES (
      v_order.user_id,
      p_order_id,
      v_order.total_amount,
      'completed',
      p_provider,
      p_razorpay_payment_id,
      p_razorpay_order_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'order_id', p_order_id,
    'payment_id', p_razorpay_payment_id,
    'provider', p_provider
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', TRUE, 'order_id', p_order_id, 'already_processed', TRUE);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_pod_payment_and_update(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_pod_payment_and_update(UUID, TEXT, TEXT, TEXT, UUID) FROM authenticated;

NOTIFY pgrst, 'reload schema';
