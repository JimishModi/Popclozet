-- ============================================================
-- Migration: Inventory Stock Protection with Safe Recovery
-- Date: 2026-04-07
--
-- Implements:
--   1. updated_at column on inventory
--   2. product_variants compatibility view (read-only)
--   3. decrement_stock / increment_stock RPCs
--   4. reserve_checkout_stock / release_checkout_stock RPCs
--   5. order_stock_reservations table for durable bookkeeping
--   6. release_order_stock RPC (idempotent, used by cron/webhook/cancel)
--   7. Updated stale order cleanup to release stock properly
--   8. Updated cancel_order_safe to use the release path
-- ============================================================

-- ============================================================
-- 1. Add updated_at to inventory (if missing)
-- ============================================================
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Auto-update updated_at on inventory changes
CREATE OR REPLACE FUNCTION public.inventory_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON public.inventory;
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_set_updated_at();

-- ============================================================
-- 2. product_variants compatibility view (read-only)
-- ============================================================
CREATE OR REPLACE VIEW public.product_variants AS
SELECT
  i.id,
  i.product_id,
  i.size,
  i.available_stock AS stock,
  i.updated_at
FROM public.inventory i;

COMMENT ON VIEW public.product_variants IS
'Read-only compatibility view over inventory. Use inventory table for writes.';

-- ============================================================
-- 3. decrement_stock / increment_stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_variant_id UUID,
  p_quantity   INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INT;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quantity must be positive');
  END IF;

  SELECT available_stock INTO v_current
  FROM inventory
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Variant not found');
  END IF;

  IF v_current < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient stock',
      'available', v_current,
      'requested', p_quantity
    );
  END IF;

  UPDATE inventory
  SET available_stock = available_stock - p_quantity
  WHERE id = p_variant_id;

  RETURN jsonb_build_object('success', true, 'new_stock', v_current - p_quantity);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_stock(
  p_variant_id UUID,
  p_quantity   INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INT;
  v_total   INT;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quantity must be positive');
  END IF;

  SELECT available_stock, total_stock INTO v_current, v_total
  FROM inventory
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Variant not found');
  END IF;

  -- Cap at total_stock to prevent over-increment
  UPDATE inventory
  SET available_stock = LEAST(v_total, available_stock + p_quantity)
  WHERE id = p_variant_id;

  RETURN jsonb_build_object('success', true, 'new_stock', LEAST(v_total, v_current + p_quantity));
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_stock(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_stock(UUID, INT) TO authenticated;

-- ============================================================
-- 4. reserve_checkout_stock
--    Atomically reserves stock for all items in one transaction.
--    Items sorted by variant_id ASC to prevent deadlocks.
--    All-or-nothing: fails if any line can't be reserved.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_checkout_stock(
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item      RECORD;
  v_current   INT;
  v_reserved  JSONB := '[]'::JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No items provided');
  END IF;

  -- Process items sorted by variant_id to prevent deadlocks
  FOR v_item IN
    SELECT
      (elem->>'variant_id')::UUID AS variant_id,
      (elem->>'quantity')::INT    AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'variant_id')::UUID ASC
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for variant %', v_item.variant_id
        USING ERRCODE = 'P0001';
    END IF;

    SELECT available_stock INTO v_current
    FROM inventory
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant % not found', v_item.variant_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_current < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for variant %. Available: %, Requested: %',
        v_item.variant_id, v_current, v_item.quantity
        USING ERRCODE = 'P0003';
    END IF;

    UPDATE inventory
    SET available_stock = available_stock - v_item.quantity
    WHERE id = v_item.variant_id;

    v_reserved := v_reserved || jsonb_build_array(
      jsonb_build_object('variant_id', v_item.variant_id, 'quantity', v_item.quantity)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reserved_items', v_reserved);

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction rolls back automatically; stock is untouched
    RETURN jsonb_build_object(
      'success', false,
      'code', SQLSTATE,
      'message', SQLERRM
    );
END;
$$;

-- ============================================================
-- 5. release_checkout_stock (symmetric restore)
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_checkout_stock(
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    RECORD;
  v_total   INT;
  v_released JSONB := '[]'::JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No items provided');
  END IF;

  FOR v_item IN
    SELECT
      (elem->>'variant_id')::UUID AS variant_id,
      (elem->>'quantity')::INT    AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'variant_id')::UUID ASC
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT total_stock INTO v_total
    FROM inventory
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE; -- Skip unknown variants gracefully
    END IF;

    UPDATE inventory
    SET available_stock = LEAST(v_total, available_stock + v_item.quantity)
    WHERE id = v_item.variant_id;

    v_released := v_released || jsonb_build_array(
      jsonb_build_object('variant_id', v_item.variant_id, 'quantity', v_item.quantity)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'released_items', v_released);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_checkout_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_checkout_stock(JSONB) TO authenticated;

-- ============================================================
-- 6. order_stock_reservations table
--    Durable record of what was reserved per order.
--    release_order_stock uses this to know what to release.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_stock_reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  variant_id     UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity       INT  NOT NULL CHECK (quantity > 0),
  released_at    TIMESTAMPTZ,
  release_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active (unreleased) reservation per variant per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_osr_order_variant_active
  ON public.order_stock_reservations (order_id, variant_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_osr_order_id
  ON public.order_stock_reservations (order_id);

ALTER TABLE public.order_stock_reservations ENABLE ROW LEVEL SECURITY;

-- Customers can read their own reservations (via order ownership)
CREATE POLICY "Users can view own order reservations"
  ON public.order_stock_reservations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_stock_reservations.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- Only SECURITY DEFINER functions write to this table
-- No INSERT/UPDATE/DELETE policies for authenticated

-- ============================================================
-- 7. release_order_stock RPC
--    Idempotent: marks reservation rows as released, then
--    increments inventory. Safe for retries from cron/webhook/cancel.
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_order_stock(
  p_order_id UUID,
  p_reason   TEXT DEFAULT 'manual'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_released    INT := 0;
  v_total_stock INT;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'order_id required');
  END IF;

  -- Process each unreleased reservation for this order
  FOR v_reservation IN
    SELECT id, variant_id, quantity
    FROM order_stock_reservations
    WHERE order_id = p_order_id
      AND released_at IS NULL
    ORDER BY variant_id ASC
    FOR UPDATE
  LOOP
    -- Mark as released
    UPDATE order_stock_reservations
    SET released_at = NOW(),
        release_reason = p_reason
    WHERE id = v_reservation.id;

    -- Restore inventory (cap at total_stock)
    SELECT total_stock INTO v_total_stock
    FROM inventory
    WHERE id = v_reservation.variant_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE inventory
      SET available_stock = LEAST(v_total_stock, available_stock + v_reservation.quantity)
      WHERE id = v_reservation.variant_id;
    END IF;

    v_released := v_released + 1;
  END LOOP;

  -- Log to warehouse activity
  IF v_released > 0 AND to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
    INSERT INTO public.warehouse_activity_log (
      action, entity_type, entity_id,
      actor_id, details
    ) VALUES (
      'stock_released',
      'order',
      p_order_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      jsonb_build_object('reason', p_reason, 'reservations_released', v_released)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released,
    'reason', p_reason
  );
END;
$$;

-- release_order_stock is internal-only (called by edge functions, cron, triggers)
REVOKE ALL ON FUNCTION public.release_order_stock(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_order_stock(UUID, TEXT) FROM authenticated;

-- ============================================================
-- 8. Replace the old inventory trigger with reservation-aware version
--    The old trigger (deduct_inventory_on_dispatch) decremented stock
--    when orders entered pending_payment/confirmed. Now stock is
--    decremented via reserve_checkout_stock BEFORE order creation.
--
--    We keep the cancellation release path but route it through
--    release_order_stock for idempotency.
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
  -- CASE A: Stock reservation is now handled by reserve_checkout_stock RPC
  -- called explicitly before order creation. No trigger-based reservation needed.

  -- CASE B: RELEASE stock when order is cancelled (via release_order_stock)
  IF (
    TG_OP = 'UPDATE'
    AND NEW.status = 'cancelled'
    AND OLD.status IS DISTINCT FROM 'cancelled'
    AND OLD.status IN ('pending_payment', 'confirmed', 'packed',
                       'ready_for_pickup', 'rider_assigned')
  ) THEN
    -- Use the idempotent release path
    PERFORM public.release_order_stock(NEW.id, 'order_cancelled');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. Update cancel_order_safe to use release path
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_order_safe(
  p_order_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;

  SELECT id, user_id, status INTO v_order
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF v_order.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
  END IF;

  IF v_order.status NOT IN ('pending', 'pending_payment', 'confirmed') THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_STATE',
      'message', format('Cannot cancel order in state: %s', v_order.status)
    );
  END IF;

  -- Release reserved stock via the idempotent path
  PERFORM public.release_order_stock(p_order_id, 'customer_cancelled');

  UPDATE orders SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'new_status', 'cancelled');
END;
$$;

-- ============================================================
-- 10. Update stale order cleanup cron
--     Now calls release_order_stock before cancelling.
-- ============================================================
DO $inner$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old job
    BEGIN
      PERFORM cron.unschedule('cancel_stale_pending_orders_v2');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- New job: release stock, then cancel
    PERFORM cron.schedule(
      'cancel_stale_pending_orders_v3',
      '*/5 * * * *',
      $$
        DO $cron$
        DECLARE
          v_order RECORD;
        BEGIN
          FOR v_order IN
            SELECT id
            FROM public.orders
            WHERE status = 'pending_payment'
              AND created_at < NOW() - INTERVAL '30 minutes'
              AND id NOT IN (
                SELECT order_id FROM public.payments
                WHERE razorpay_payment_id IS NOT NULL
              )
            FOR UPDATE SKIP LOCKED
          LOOP
            -- Release stock first (idempotent)
            PERFORM public.release_order_stock(v_order.id, 'stale_cleanup');
            -- Then cancel
            UPDATE public.orders
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = v_order.id;
          END LOOP;
        END $cron$;
      $$
    );
    RAISE NOTICE 'pg_cron job scheduled: cancel_stale_pending_orders_v3 (with stock release)';
  ELSE
    RAISE NOTICE 'pg_cron not available — skipping stale order cleanup update';
  END IF;
END $inner$;

-- ============================================================
-- 11. Grant service_role access to release_order_stock
--     Edge functions (webhook, verify) use adminClient with service_role
-- ============================================================
-- service_role inherits from postgres and has SUPERUSER-like access,
-- so no explicit GRANT is needed. The REVOKE above only blocks
-- authenticated and public roles.

-- ============================================================
-- 12. Add payment_failed to the orders status check constraint
-- ============================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending', 'pending_payment', 'payment_failed',
    'placed', 'confirmed', 'preparing', 'packed',
    'ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched',
    'out_for_delivery', 'delivered', 'in_use',
    'pickup_scheduled', 'picked_up',
    'return_requested', 'return_scheduled', 'return_dispatched', 'return_picked_up', 'return_completed',
    'returned', 'completed', 'cancelled'
  ));

-- ============================================================
-- 13. Update verify_payment_and_update to also accept payment_failed orders
--     (for the case where payment.failed webhook fires first, then
--      payment.captured fires later — success always wins)
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

  -- Allow from pre-payment states AND payment_failed (success overrides failure)
  IF v_order.status NOT IN ('pending', 'pending_payment', 'payment_failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATE',
      'message', format('Cannot verify payment for order in state: %s', v_order.status)
    );
  END IF;

  -- Anti-substitution
  IF v_order.razorpay_order_id IS NOT NULL
     AND v_order.razorpay_order_id != p_razorpay_order_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ORDER_MISMATCH',
      'message', 'Razorpay order ID does not match the stored value'
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
    v_order.user_id, p_order_id, v_order.total_amount, 'completed', p_provider,
    p_razorpay_payment_id, p_razorpay_order_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'new_status', v_new_status,
    'payment_id', p_razorpay_payment_id
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

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
