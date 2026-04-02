-- ============================================================
-- Migration: Production-Safe Atomic Order Placement
-- Date: 2026-04-02
--
-- Fixes:
--   1. Order + order_items created atomically (single transaction)
--   2. Prices fetched from DB server-side (never trust client)
--   3. Idempotency key prevents duplicate orders (double-click, retries)
--   4. Proper state machine integration for initial status
--   5. Row-level locking prevents race conditions
--   6. Full rollback on any failure (no partial data)
-- ============================================================

-- 1. Add idempotency_key column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Unique partial index (NULLs allowed, but non-null values must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. Ensure pricing columns exist on products (safe idempotent adds)
ALTER TABLE products ADD COLUMN IF NOT EXISTS rental_price_1d NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS rental_price_2d NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS rental_price_3d NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_price NUMERIC(10,2);

-- 3. Ensure pricing_plan column exists on order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pricing_plan TEXT;

-- ============================================================
-- 4. CORE RPC: place_order
--
-- The frontend sends ONLY: product IDs, sizes, plans, quantities.
-- ALL prices are resolved from the products table server-side.
-- The total is computed server-side. Client total is ignored.
-- ============================================================
CREATE OR REPLACE FUNCTION place_order(
  p_idempotency_key    TEXT,
  p_address_id         UUID,
  p_start_date         TIMESTAMPTZ,
  p_end_date           TIMESTAMPTZ,
  p_payment_method     TEXT,            -- 'cod' | 'upi' | 'razorpay'
  p_items              JSONB,           -- [{product_id, size, plan, quantity}]
  p_delivery_fee       NUMERIC DEFAULT 0,
  p_route_distance_km  NUMERIC DEFAULT 0,
  p_delivery_eta       TIMESTAMPTZ DEFAULT NULL,
  p_return_pickup_date TEXT DEFAULT NULL,
  p_return_time_slot   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_order_id      UUID;
  v_existing      RECORD;
  v_item          JSONB;
  v_product       RECORD;
  v_unit_price    NUMERIC;
  v_line_total    NUMERIC;
  v_subtotal      NUMERIC := 0;
  v_total         NUMERIC;
  v_status        TEXT;
  v_plan_days     INT;
  v_item_count    INT := 0;
BEGIN
  -- ==============================
  -- AUTH: Get caller's user ID
  -- ==============================
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to place an order'
    );
  END IF;

  -- ==============================
  -- IDEMPOTENCY: Return existing order if key was already used
  -- Uses advisory lock on the key hash to prevent two concurrent
  -- requests from both passing the SELECT check before either INSERTs.
  -- ==============================
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    -- Advisory lock scoped to this idempotency key
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));

    SELECT id, status INTO v_existing
    FROM orders
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing.id,
        'status', v_existing.status,
        'idempotent', true,
        'message', 'Order already exists for this request'
      );
    END IF;
  END IF;

  -- ==============================
  -- VALIDATE: Items array must be non-empty
  -- ==============================
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EMPTY_CART',
      'message', 'Cannot place an order with no items'
    );
  END IF;

  -- ==============================
  -- VALIDATE: Address belongs to user
  -- ==============================
  IF NOT EXISTS (
    SELECT 1 FROM addresses WHERE id = p_address_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_ADDRESS',
      'message', 'Delivery address not found or does not belong to you'
    );
  END IF;

  -- ==============================
  -- STATUS: Determine initial order status
  -- ==============================
  IF p_payment_method = 'cod' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
  END IF;

  -- ==============================
  -- CREATE ORDER (no total yet — computed after items)
  -- ==============================
  INSERT INTO orders (
    user_id,
    delivery_address_id,
    rental_start_date,
    rental_end_date,
    total_amount,
    delivery_eta,
    status,
    payment_method,
    delivery_fee,
    route_distance_km,
    return_pickup_date,
    return_time_slot,
    idempotency_key
  ) VALUES (
    v_user_id,
    p_address_id,
    p_start_date,
    p_end_date,
    0,  -- placeholder, updated below
    p_delivery_eta,
    v_status,
    p_payment_method,
    p_delivery_fee,
    p_route_distance_km,
    p_return_pickup_date,
    p_return_time_slot,
    p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- ==============================
  -- INSERT ITEMS: Prices fetched from products table
  -- ==============================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Look up the product and its pricing columns
    SELECT
      id,
      rental_price,
      rental_price_1d,
      rental_price_2d,
      rental_price_3d,
      buy_price,
      is_available
    INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID;

    -- Product must exist
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'product_id'
        USING ERRCODE = 'P0002';
    END IF;

    -- Product must be available
    IF v_product.is_available IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Product % is not available for rent', v_item->>'product_id'
        USING ERRCODE = 'P0003';
    END IF;

    -- Resolve price based on plan (server-side, NOT from client)
    v_unit_price := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN COALESCE(v_product.rental_price_1d, v_product.rental_price)
      WHEN '2d' THEN COALESCE(v_product.rental_price_2d, v_product.rental_price)
      WHEN '3d' THEN COALESCE(v_product.rental_price_3d, v_product.rental_price)
      WHEN 'buy' THEN COALESCE(v_product.buy_price, v_product.rental_price * 5)
      ELSE v_product.rental_price
    END;

    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION 'No valid price for product % plan %',
        v_item->>'product_id', COALESCE(v_item->>'plan', '3d')
        USING ERRCODE = 'P0004';
    END IF;

    -- Plan to rental_duration_days mapping
    v_plan_days := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN 1
      WHEN '2d' THEN 2
      WHEN '3d' THEN 3
      WHEN 'buy' THEN 0
      ELSE 3
    END;

    -- Calculate line total (unit price * quantity)
    v_line_total := v_unit_price * GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);

    INSERT INTO order_items (
      order_id,
      product_id,
      size,
      rental_price,
      rental_duration_days,
      pricing_plan
    ) VALUES (
      v_order_id,
      v_product.id,
      COALESCE(v_item->>'size', 'One Size'),
      v_line_total,
      v_plan_days,
      COALESCE(v_item->>'plan', '3d')
    );

    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + 1;
  END LOOP;

  -- ==============================
  -- UPDATE ORDER: Set server-computed total
  -- ==============================
  v_total := v_subtotal + COALESCE(p_delivery_fee, 0);

  UPDATE orders
  SET total_amount = v_total,
      subtotal_amount = v_subtotal
  WHERE id = v_order_id;

  -- ==============================
  -- SUCCESS
  -- ==============================
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'status', v_status,
    'subtotal', v_subtotal,
    'delivery_fee', COALESCE(p_delivery_fee, 0),
    'total', v_total,
    'item_count', v_item_count,
    'idempotent', false
  );

EXCEPTION
  -- Any RAISE EXCEPTION or constraint violation rolls back the entire
  -- transaction automatically (order + all items deleted).
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', SQLSTATE,
      'message', SQLERRM
    );
END;
$$;

-- 5. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION place_order TO authenticated;

COMMENT ON FUNCTION place_order IS
'Atomic order placement. Creates order + items in a single transaction.
Prices are ALWAYS fetched from the products table (never trusted from client).
Idempotency key prevents duplicate orders from double-clicks or retries.
On ANY failure, the entire transaction rolls back — no partial data.';

-- ============================================================
-- 6. Secure payment confirmation (row-locked, state-validated)
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_order_payment(
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
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  IF v_order.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Not your order');
  END IF;

  IF v_order.status NOT IN ('pending', 'pending_payment') THEN
    -- Already confirmed? Return success (idempotent)
    IF v_order.status IN ('confirmed', 'packed', 'dispatched') THEN
      RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_STATE',
      'message', format('Cannot confirm payment for order in state: %s', v_order.status)
    );
  END IF;

  UPDATE orders SET status = 'confirmed', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'new_status', 'confirmed');
END;
$$;

-- ============================================================
-- 7. Secure cancel (row-locked, state-validated)
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

  UPDATE orders SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'new_status', 'cancelled');
END;
$$;

-- ============================================================
-- 8. Secure keep-item / buyout (row-locked, state-validated)
-- ============================================================
CREATE OR REPLACE FUNCTION keep_item_safe(
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

  IF v_order.status NOT IN ('delivered', 'in_use') THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_STATE',
      'message', format('Cannot keep item in state: %s', v_order.status)
    );
  END IF;

  UPDATE orders SET status = 'completed', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'new_status', 'completed');
END;
$$;

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION confirm_order_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_order_safe(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION keep_item_safe(UUID) TO authenticated;