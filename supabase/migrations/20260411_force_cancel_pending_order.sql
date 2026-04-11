-- ============================================================
-- 20260411_force_cancel_pending_order.sql
--
-- Purpose:
--   Provide a client-callable RPC that IMMEDIATELY cancels a
--   pending_payment / payment_failed order and releases its
--   reserved inventory. This is invoked by the customer app's
--   `useRazorpayCheckout` hook the instant the user closes the
--   Razorpay checkout modal, so stock is restored without waiting
--   for the 10-minute `cancel_stale_pending_orders_v4` cron job.
--
-- Contract:
--   SELECT * FROM force_cancel_pending_order(order_id := '<uuid>');
--
--   Parameter name is `order_id` (not `p_order_id`) to match the
--   exact key supplied by the client in supabase.rpc(...).
--
-- Behaviour:
--   1. Verifies the order exists and belongs to the calling user
--      (or allows service_role to bypass the ownership check).
--   2. Only cancels orders in a pre-fulfillment state
--      (pending, pending_payment, payment_failed). If the order
--      has already been confirmed / paid / dispatched, the call is
--      a no-op and returns `{ success: false, code: 'INVALID_STATE' }`.
--   3. Idempotent: calling it on an already-cancelled order
--      returns `{ success: true, already_cancelled: true }`.
--   4. Releases reservations + restores available_stock by calling
--      `release_order_stock(order_id, 'user_cancelled_payment')`,
--      which is the same helper used by the stale-order cron job
--      and the webhook payment-failed path.
--   5. Sets orders.status = 'cancelled'.
-- ============================================================

-- Drop any previous signature of this function. A prior version of
-- force_cancel_pending_order(uuid) exists in the DB with a different
-- return type, and Postgres refuses to CREATE OR REPLACE across
-- return-type changes (error 42P13). DROP ... IF EXISTS is the
-- sanctioned escape hatch.
DROP FUNCTION IF EXISTS public.force_cancel_pending_order(UUID);

CREATE OR REPLACE FUNCTION public.force_cancel_pending_order(
  order_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   RECORD;
  v_caller  UUID := auth.uid();
  v_release JSONB;
BEGIN
  IF order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT',
                              'message', 'order_id is required');
  END IF;

  -- Lock the order row so concurrent webhook / cron calls can't race us
  SELECT id, user_id, status
    INTO v_order
    FROM public.orders
   WHERE id = order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
                              'message', 'Order not found');
  END IF;

  -- Ownership check: the order must belong to the caller.
  -- service_role (webhook / server) has auth.uid() = NULL and is allowed.
  IF v_caller IS NOT NULL AND v_order.user_id IS DISTINCT FROM v_caller THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN',
                              'message', 'You do not own this order');
  END IF;

  -- Idempotent no-op if already cancelled
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', order_id,
      'already_cancelled', true
    );
  END IF;

  -- Reject orders that are past the pre-fulfillment stage. We must never
  -- flip a paid/dispatched/delivered order back to cancelled.
  IF v_order.status NOT IN ('pending', 'pending_payment', 'payment_failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATE',
      'message', format('Cannot force-cancel order in state: %s', v_order.status)
    );
  END IF;

  -- Release reserved inventory + restore available_stock / unit status.
  -- release_order_stock is idempotent (it skips reservations already
  -- marked released_at IS NOT NULL) so double calls are safe.
  v_release := public.release_order_stock(order_id, 'user_cancelled_payment');

  -- Flip the order to cancelled. The trg_deduct_inventory_on_dispatch
  -- trigger on orders.status would normally re-call release_order_stock
  -- here, but because release_order_stock is idempotent on already-released
  -- reservations, this is safe.
  UPDATE public.orders
     SET status = 'cancelled',
         updated_at = NOW()
   WHERE id = order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', order_id,
    'new_status', 'cancelled',
    'release', v_release
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', SQLSTATE,
      'message', SQLERRM
    );
END;
$$;

-- Permissions: authenticated users need EXECUTE so the customer app
-- can call this via PostgREST. The function itself enforces
-- ownership via auth.uid() so row-level access is still safe.
REVOKE ALL ON FUNCTION public.force_cancel_pending_order(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.force_cancel_pending_order(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.force_cancel_pending_order(UUID) TO service_role;

COMMENT ON FUNCTION public.force_cancel_pending_order(UUID) IS
  'Client-callable: instantly cancel a pending-payment order and release its reserved stock. '
  'Used by useRazorpayCheckout.ts when the Razorpay modal is dismissed. '
  'Wraps release_order_stock() + orders.status := cancelled inside a single transaction.';
