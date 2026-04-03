-- ============================================================
-- Migration: Payment Security Hardening
-- Date: 2026-04-02
--
-- Fixes:
--   1. Adds razorpay_order_id column to orders (anti-substitution)
--   2. Adds razorpay_payment_id, razorpay_order_id, provider columns to payments
--   3. Creates verify_payment_and_update RPC (atomic payment verification)
--   4. Adds unique constraint on razorpay_payment_id to prevent replays
-- ============================================================

-- 1. Add razorpay_order_id to orders table
--    Stores the Razorpay order ID created during payment initiation.
--    Used during verification to ensure the signature belongs to THIS order.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON orders (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- 2. Add provider and razorpay columns to payments (if not present)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'razorpay';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;

-- Unique constraint on razorpay_payment_id prevents replay attacks:
-- the same payment ID cannot be recorded twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id
  ON payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- ============================================================
-- 3. verify_payment_and_update RPC
--
-- Called by the verify-razorpay-payment edge function AFTER
-- the HMAC signature has been validated. Atomically:
--   a) Locks the order row (FOR UPDATE)
--   b) Validates the order is in a payable state
--   c) Updates order status to 'confirmed'
--   d) Inserts a payment record
--
-- If the razorpay_payment_id was already recorded (replay),
-- the unique index causes the INSERT to fail safely.
-- ============================================================
CREATE OR REPLACE FUNCTION verify_payment_and_update(
  p_order_id            UUID,
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_provider            TEXT DEFAULT 'razorpay'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_new_status TEXT;
BEGIN
  -- Lock the order row to prevent concurrent verification
  SELECT id, user_id, status, total_amount, razorpay_order_id, order_type
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  -- Idempotent: already processed
  IF v_order.status IN ('confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered') THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
  END IF;

  -- Only allow from valid pre-payment states
  IF v_order.status NOT IN ('pending', 'pending_payment') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATE',
      'message', format('Cannot verify payment for order in state: %s', v_order.status)
    );
  END IF;

  -- Anti-substitution: verify razorpay_order_id matches what was stored at creation
  IF v_order.razorpay_order_id IS NOT NULL
     AND v_order.razorpay_order_id != p_razorpay_order_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ORDER_MISMATCH',
      'message', 'Razorpay order ID does not match the stored value'
    );
  END IF;

  -- Buyout orders → completed (customer already has the item, no delivery needed)
  -- Regular orders → confirmed (enters the delivery pipeline)
  v_new_status := CASE WHEN v_order.order_type = 'buyout' THEN 'completed' ELSE 'confirmed' END;

  -- Update order status
  UPDATE orders
  SET status = v_new_status,
      razorpay_order_id = p_razorpay_order_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert payment record (unique index on razorpay_payment_id prevents replays)
  INSERT INTO payments (
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

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'new_status', v_new_status,
    'payment_id', p_razorpay_payment_id
  );

EXCEPTION
  WHEN unique_violation THEN
    -- razorpay_payment_id already exists = replay attempt
    -- Return success idempotently (the payment was already recorded)
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

-- Only callable by service_role (edge functions use adminClient)
-- NOT granted to authenticated — this is an internal-only function.
REVOKE ALL ON FUNCTION verify_payment_and_update FROM PUBLIC;
REVOKE ALL ON FUNCTION verify_payment_and_update FROM authenticated;

COMMENT ON FUNCTION verify_payment_and_update IS
'Atomic payment verification. Called by the verify-razorpay-payment edge function
after HMAC signature validation. Locks the order row, validates state, updates
status to confirmed, and inserts a payment record. Replay-safe via unique index
on razorpay_payment_id.';

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
