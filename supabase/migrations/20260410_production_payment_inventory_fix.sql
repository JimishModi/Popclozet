-- ============================================================
-- Migration: Production-Grade Payment & Inventory Fix
-- Date: 2026-04-10
--
-- ROOT CAUSES FIXED:
--   1. Stock reservation was a 3-step client-side dance that could
--      break at any point, leaving stock permanently stuck.
--      FIX: Move reservation INTO place_order as a single atomic transaction.
--
--   2. Payment cancellation relied on pg_cron (5min interval, 30min timeout).
--      FIX: Reduce timeout to 10min, add payment_failed webhook handling
--      that immediately releases stock and cancels.
--
--   3. trg_reconcile_inventory_units_after_stock_change auto-created
--      synthetic all_products rows with NULL fields on every inventory update.
--      FIX: Disable auto-reconciliation trigger. Inventory counters are the
--      source of truth; all_products units are managed only by warehouse staff.
--
--   4. Multiple sources of truth (inventory.available_stock, all_products.status,
--      products.is_available) were never synchronized.
--      FIX: Add trigger to sync products.is_available from inventory, and
--      make checkout always read from inventory.available_stock.
-- ============================================================

-- ============================================================
-- PHASE 1: STOP THE PHANTOM UNIT FACTORY
--
-- The reconcile trigger creates synthetic all_products rows on every
-- inventory counter change. This is the direct cause of NULL rows.
-- Inventory counters (available_stock, rented_stock, etc.) are the
-- source of truth for stock availability. Physical unit tracking
-- (all_products) is a warehouse concern, not a checkout concern.
-- ============================================================

-- 1a. Drop the trigger that auto-creates phantom units
DROP TRIGGER IF EXISTS trg_reconcile_inventory_units_after_stock_change ON public.inventory;

-- 1b. Clean up existing phantom/NULL rows created by the trigger.
-- Phantom rows have auto-generated IDs matching the pattern and have
-- never been rented or washed (warehouse-created units will have activity).
--
-- The prevent_physical_unit_hard_delete trigger may still be active
-- (blocks DELETE unless status is 'archived'/'lost'/'damaged').
-- So we first archive the phantoms, then delete them.
DO $$
BEGIN
  IF to_regclass('public.all_products') IS NOT NULL THEN
    -- Step 1: Mark phantom rows as 'archived' so the delete guard allows removal
    UPDATE public.all_products ap
    SET status = 'archived'
    WHERE ap.individual_id ~ '^PC-[A-F0-9]{8}-[A-Z0-9]{1,8}-[A-Z0-9]{4,8}$'
      AND COALESCE(ap.times_rented, 0) = 0
      AND ap.last_rented IS NULL
      AND ap.last_washed IS NULL
      AND ap.status NOT IN ('archived', 'lost', 'damaged')
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.individual_id = ap.individual_id
      );

    -- Step 2: Delete the now-archived phantom rows
    DELETE FROM public.all_products ap
    WHERE ap.individual_id ~ '^PC-[A-F0-9]{8}-[A-Z0-9]{1,8}-[A-Z0-9]{4,8}$'
      AND COALESCE(ap.times_rented, 0) = 0
      AND ap.last_rented IS NULL
      AND ap.last_washed IS NULL
      AND ap.status IN ('archived', 'lost', 'damaged')
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.individual_id = ap.individual_id
      );

    RAISE NOTICE 'Cleaned up phantom all_products rows';
  END IF;
END $$;

-- 1c. Recalculate inventory counters from actual all_products units
-- (now that phantoms are removed, counters will be accurate)
DO $$
DECLARE
  v_inv RECORD;
BEGIN
  IF to_regclass('public.all_products') IS NOT NULL
     AND to_regprocedure('public.recalculate_inventory_stock_from_units(uuid)') IS NOT NULL THEN
    PERFORM set_config('popclozet.reconciling_inventory_units', 'on', TRUE);
    FOR v_inv IN SELECT id FROM public.inventory ORDER BY id FOR UPDATE LOOP
      PERFORM public.recalculate_inventory_stock_from_units(v_inv.id);
    END LOOP;
    PERFORM set_config('popclozet.reconciling_inventory_units', 'off', TRUE);
    RAISE NOTICE 'Recalculated all inventory counters from physical units';
  END IF;
END $$;


-- ============================================================
-- PHASE 2: ATOMIC PLACE_ORDER WITH BUILT-IN STOCK RESERVATION
--
-- The old flow was:
--   Client: reserve_checkout_stock() → place_order() → persist_order_stock_reservations()
-- If any step failed, stock could be stuck. The new flow is:
--   Client: place_order()  ← does everything atomically
--
-- place_order now:
--   1. Resolves variant_ids from product_id + size
--   2. Locks inventory rows (sorted by id to prevent deadlocks)
--   3. Checks available_stock >= quantity
--   4. Decrements available_stock, increments rented_stock
--   5. Creates the order + order_items
--   6. Creates order_stock_reservations records
--   7. All in ONE transaction — any failure rolls back everything
-- ============================================================

-- Drop the OLD overload (p_delivery_fee as 7th param, no p_coupon_code).
-- This was created by 20260402_atomic_place_order / 20260403_order_notification_hardening.
-- CREATE OR REPLACE with a different signature creates a second overload instead
-- of replacing, so both coexist and cause "function name is not unique" errors.
DROP FUNCTION IF EXISTS public.place_order(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION place_order(
  p_idempotency_key    TEXT,
  p_address_id         UUID,
  p_start_date         TIMESTAMPTZ,
  p_end_date           TIMESTAMPTZ,
  p_payment_method     TEXT,
  p_items              JSONB,
  p_coupon_code        TEXT DEFAULT NULL,
  p_route_distance_km  NUMERIC DEFAULT 0,
  p_delivery_eta       TIMESTAMPTZ DEFAULT NULL,
  p_return_pickup_date TEXT DEFAULT NULL,
  p_return_time_slot   TEXT DEFAULT NULL,
  -- DEPRECATED: kept for backward compat but IGNORED
  p_delivery_fee       NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID;
  v_order_id        UUID;
  v_existing        RECORD;
  v_item            JSONB;
  v_product         RECORD;
  v_inv             RECORD;
  v_unit_price      NUMERIC;
  v_line_total      NUMERIC;
  v_subtotal        NUMERIC := 0;
  v_delivery_fee    NUMERIC;
  v_coupon_result   JSONB;
  v_coupon_discount NUMERIC := 0;
  v_coupon_code_upper TEXT;
  v_total           NUMERIC;
  v_status          TEXT;
  v_plan_days       INT;
  v_item_count      INT := 0;
  v_item_size       TEXT;
  v_item_qty        INT;
BEGIN
  -- ==============================
  -- AUTH
  -- ==============================
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to place an order');
  END IF;

  -- ==============================
  -- IDEMPOTENCY
  -- ==============================
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));
    SELECT id, status INTO v_existing
    FROM orders WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'order_id', v_existing.id, 'status', v_existing.status,
        'idempotent', true, 'message', 'Order already exists for this request');
    END IF;
  END IF;

  -- ==============================
  -- VALIDATE items
  -- ==============================
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_CART',
      'message', 'Cannot place an order with no items');
  END IF;

  -- ==============================
  -- VALIDATE address ownership
  -- ==============================
  IF NOT EXISTS (
    SELECT 1 FROM addresses WHERE id = p_address_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ADDRESS',
      'message', 'Delivery address not found or does not belong to you');
  END IF;

  -- ==============================
  -- COMPUTE DELIVERY FEE (server-side)
  -- ==============================
  v_delivery_fee := compute_delivery_fee(p_route_distance_km);
  IF v_delivery_fee = -1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'OUT_OF_RANGE',
      'message', 'Sorry, this area is outside our delivery range (max 7km).');
  END IF;

  -- ==============================
  -- STATUS
  -- ==============================
  IF p_payment_method = 'cod' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
  END IF;

  -- ==============================
  -- RESERVE STOCK ATOMICALLY (inside this transaction)
  -- Lock inventory rows sorted by id to prevent deadlocks.
  -- If any item is out of stock, the entire transaction rolls back.
  -- ==============================
  -- We need to process items in a deterministic order for deadlock prevention.
  -- First pass: validate products + check/reserve inventory
  FOR v_item IN
    SELECT elem
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'product_id')::TEXT, COALESCE(elem->>'size', 'One Size')
  LOOP
    v_item_size := COALESCE(v_item->>'size', 'One Size');
    v_item_qty := GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);

    -- Look up the product
    SELECT id, rental_price, rental_price_1d, rental_price_2d, rental_price_3d,
           buy_price, is_available
    INTO v_product
    FROM products WHERE id = (v_item->>'product_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'product_id' USING ERRCODE = 'P0002';
    END IF;

    IF v_product.is_available IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Product % is not available', v_item->>'product_id' USING ERRCODE = 'P0003';
    END IF;

    -- Lock and check inventory for this product+size
    SELECT i.id, i.available_stock, i.rented_stock, i.total_stock
    INTO v_inv
    FROM inventory i
    WHERE i.product_id = (v_item->>'product_id')::UUID
      AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item_size
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory for product % size %', v_item->>'product_id', v_item_size
        USING ERRCODE = 'P0003';
    END IF;

    IF v_inv.available_stock < v_item_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % size %. Available: %, Requested: %',
        v_item->>'product_id', v_item_size, v_inv.available_stock, v_item_qty
        USING ERRCODE = 'P0003';
    END IF;

    -- Reserve: move from available to rented
    -- Use set_config to prevent the reconcile trigger from firing
    PERFORM set_config('popclozet.reconciling_inventory_units', 'on', TRUE);

    UPDATE inventory
    SET available_stock = available_stock - v_item_qty,
        rented_stock = rented_stock + v_item_qty
    WHERE id = v_inv.id;

    PERFORM set_config('popclozet.reconciling_inventory_units', 'off', TRUE);
  END LOOP;

  -- ==============================
  -- CREATE ORDER
  -- ==============================
  INSERT INTO orders (
    user_id, delivery_address_id, rental_start_date, rental_end_date,
    total_amount, delivery_eta, status, payment_method,
    delivery_fee, route_distance_km, return_pickup_date, return_time_slot,
    idempotency_key
  ) VALUES (
    v_user_id, p_address_id, p_start_date, p_end_date,
    0, p_delivery_eta, v_status, p_payment_method,
    v_delivery_fee, p_route_distance_km,
    NULLIF(p_return_pickup_date, '')::DATE, p_return_time_slot,
    p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- ==============================
  -- INSERT ITEMS + STOCK RESERVATIONS (prices from DB)
  -- ==============================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_size := COALESCE(v_item->>'size', 'One Size');
    v_item_qty := GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);

    -- Re-fetch product for pricing (already validated above)
    SELECT id, rental_price, rental_price_1d, rental_price_2d, rental_price_3d, buy_price
    INTO v_product
    FROM products WHERE id = (v_item->>'product_id')::UUID;

    v_unit_price := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN COALESCE(v_product.rental_price_1d, v_product.rental_price)
      WHEN '2d' THEN COALESCE(v_product.rental_price_2d, v_product.rental_price)
      WHEN '3d' THEN COALESCE(v_product.rental_price_3d, v_product.rental_price)
      WHEN 'buy' THEN COALESCE(v_product.buy_price, v_product.rental_price * 5)
      ELSE v_product.rental_price
    END;

    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION 'No valid price for product % plan %',
        v_item->>'product_id', COALESCE(v_item->>'plan', '3d') USING ERRCODE = 'P0004';
    END IF;

    v_plan_days := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN 1 WHEN '2d' THEN 2 WHEN '3d' THEN 3 WHEN 'buy' THEN 0 ELSE 3
    END;

    v_line_total := v_unit_price * v_item_qty;

    INSERT INTO order_items (order_id, product_id, size, rental_price, rental_duration_days, pricing_plan)
    VALUES (v_order_id, v_product.id, v_item_size, v_line_total, v_plan_days, COALESCE(v_item->>'plan', '3d'));

    -- Create durable stock reservation record (used by release_order_stock on cancel)
    SELECT i.id INTO v_inv
    FROM inventory i
    WHERE i.product_id = (v_item->>'product_id')::UUID
      AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item_size;

    IF FOUND THEN
      INSERT INTO order_stock_reservations (order_id, variant_id, quantity)
      VALUES (v_order_id, v_inv.id, v_item_qty)
      ON CONFLICT DO NOTHING;
    END IF;

    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + 1;
  END LOOP;

  -- ==============================
  -- VALIDATE & APPLY COUPON
  -- ==============================
  v_coupon_code_upper := UPPER(TRIM(COALESCE(p_coupon_code, '')));
  IF v_coupon_code_upper != '' THEN
    v_coupon_result := validate_coupon(v_coupon_code_upper, v_user_id, v_subtotal);

    IF NOT (v_coupon_result->>'valid')::BOOLEAN THEN
      RAISE EXCEPTION 'Coupon error: %', COALESCE(v_coupon_result->>'message', v_coupon_result->>'reason')
        USING ERRCODE = 'P0005';
    END IF;

    v_coupon_discount := (v_coupon_result->>'discount')::NUMERIC;

    INSERT INTO coupon_usages (coupon_id, user_id, order_id)
    VALUES ((v_coupon_result->>'coupon_id')::UUID, v_user_id, v_order_id);

    UPDATE coupons SET times_used = COALESCE(times_used, 0) + 1
    WHERE id = (v_coupon_result->>'coupon_id')::UUID;
  END IF;

  -- ==============================
  -- UPDATE ORDER with server-computed totals
  -- ==============================
  v_total := v_subtotal - v_coupon_discount + v_delivery_fee;

  UPDATE orders
  SET total_amount = v_total,
      subtotal_amount = v_subtotal,
      delivery_fee = v_delivery_fee,
      coupon_code = CASE WHEN v_coupon_discount > 0 THEN v_coupon_code_upper ELSE NULL END,
      coupon_discount = v_coupon_discount
  WHERE id = v_order_id;

  -- ==============================
  -- LOG
  -- ==============================
  IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
    INSERT INTO public.warehouse_activity_log (
      action, entity_type, entity_id, actor_id, details
    ) VALUES (
      'order_placed_with_reservation',
      'order',
      v_order_id,
      v_user_id,
      jsonb_build_object(
        'status', v_status,
        'item_count', v_item_count,
        'total', v_total
      )
    );
  END IF;

  -- ==============================
  -- SUCCESS
  -- ==============================
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'status', v_status,
    'subtotal', v_subtotal,
    'coupon_discount', v_coupon_discount,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'item_count', v_item_count,
    'idempotent', false
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Entire transaction rolls back: order, items, reservations, AND stock changes
    RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;


-- ============================================================
-- PHASE 3: FIX INVENTORY TRIGGER TO NOT DOUBLE-DECREMENT
--
-- The old deduct_inventory_on_dispatch trigger ALSO decremented stock
-- when orders entered pending_payment/confirmed. Now that place_order
-- handles reservation atomically, the trigger must NOT touch stock on
-- order creation. It only needs to handle cancellation release.
-- ============================================================

CREATE OR REPLACE FUNCTION public.deduct_inventory_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
  -- Stock reservation is now handled atomically inside place_order.
  -- This trigger only handles the cancellation release path.

  IF (
    TG_OP = 'UPDATE'
    AND NEW.status = 'cancelled'
    AND OLD.status IS DISTINCT FROM 'cancelled'
    AND OLD.status IN ('pending_payment', 'payment_failed', 'confirmed', 'packed',
                       'ready_for_pickup', 'rider_assigned')
  ) THEN
    -- Use the idempotent release path
    PERFORM public.release_order_stock(NEW.id, 'order_cancelled');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger only fires on status UPDATE, not INSERT
-- (place_order already reserved stock before the INSERT)
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_dispatch ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_dispatch
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.deduct_inventory_on_dispatch();


-- ============================================================
-- PHASE 4: SYNC products.is_available FROM INVENTORY
--
-- products.is_available must reflect whether ANY inventory row
-- has available_stock > 0. This ensures catalog and checkout agree.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_product_availability()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_any_available BOOLEAN;
BEGIN
  -- Skip if inside reconciliation to avoid cascading triggers
  IF current_setting('popclozet.reconciling_inventory_units', TRUE) = 'on' THEN
    RETURN NEW;
  END IF;

  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  SELECT EXISTS (
    SELECT 1 FROM public.inventory
    WHERE product_id = v_product_id
      AND available_stock > 0
  ) INTO v_any_available;

  UPDATE public.products
  SET is_available = v_any_available
  WHERE id = v_product_id
    AND is_available IS DISTINCT FROM v_any_available;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_product_availability ON public.inventory;
CREATE TRIGGER trg_sync_product_availability
  AFTER INSERT OR UPDATE OF available_stock OR DELETE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_availability();

-- Backfill: sync all products.is_available now
UPDATE public.products p
SET is_available = EXISTS (
  SELECT 1 FROM public.inventory i
  WHERE i.product_id = p.id AND i.available_stock > 0
)
WHERE p.is_available IS DISTINCT FROM EXISTS (
  SELECT 1 FROM public.inventory i
  WHERE i.product_id = p.id AND i.available_stock > 0
);


-- ============================================================
-- PHASE 5: FASTER STALE ORDER CLEANUP
--
-- Reduce the timeout from 30 minutes to 10 minutes for
-- pending_payment orders. This is the safety net for cases where
-- the client-side cancel and webhook both fail.
-- ============================================================

DO $inner$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old jobs
    BEGIN PERFORM cron.unschedule('cancel_stale_pending_orders'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM cron.unschedule('cancel_stale_pending_orders_v2'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM cron.unschedule('cancel_stale_pending_orders_v3'); EXCEPTION WHEN OTHERS THEN NULL; END;

    -- New job: 10-minute timeout, runs every 2 minutes
    PERFORM cron.schedule(
      'cancel_stale_pending_orders_v4',
      '*/2 * * * *',
      $$
        DO $cron$
        DECLARE
          v_order RECORD;
        BEGIN
          FOR v_order IN
            SELECT id
            FROM public.orders
            WHERE status IN ('pending_payment', 'payment_failed')
              AND created_at < NOW() - INTERVAL '10 minutes'
              AND id NOT IN (
                SELECT order_id FROM public.payments
                WHERE razorpay_payment_id IS NOT NULL
              )
            FOR UPDATE SKIP LOCKED
          LOOP
            PERFORM public.release_order_stock(v_order.id, 'stale_cleanup_v4');
            UPDATE public.orders
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = v_order.id;
          END LOOP;
        END $cron$;
      $$
    );
    RAISE NOTICE 'pg_cron: cancel_stale_pending_orders_v4 (10min timeout, 2min interval)';
  ELSE
    RAISE NOTICE 'pg_cron not available — skipping stale order cleanup';
  END IF;
END $inner$;


-- ============================================================
-- PHASE 6: ADD NOT NULL CONSTRAINTS TO all_products
--
-- Prevent future NULL insertions into critical fields.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.all_products') IS NOT NULL THEN
    -- Ensure status always has a value
    ALTER TABLE public.all_products
      ALTER COLUMN status SET DEFAULT 'available',
      ALTER COLUMN inventory_id SET NOT NULL;

    -- Add constraint to prevent NULL individual_id (already PK, but be safe)
    -- individual_id is already the PK, so it can't be NULL

    -- Add constraint: status must be from allowed set (expand if needed)
    ALTER TABLE public.all_products DROP CONSTRAINT IF EXISTS all_products_status_check;
    ALTER TABLE public.all_products ADD CONSTRAINT all_products_status_check
      CHECK (status IN ('available', 'rented', 'returned', 'washing', 'ready',
                        'sold', 'lost', 'damaged', 'archived', 'instantly_bought'));
  END IF;
END $$;


-- ============================================================
-- PHASE 7: WEBHOOK-CALLABLE cancel_order_payment_failed
--
-- A SECURITY DEFINER function callable by service_role (webhook)
-- that immediately cancels a payment-failed order and releases stock.
-- Unlike cancel_order_safe, this doesn't require auth.uid().
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_order_payment_failed(
  p_order_id UUID,
  p_reason   TEXT DEFAULT 'payment_failed'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT');
  END IF;

  SELECT id, status INTO v_order
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  -- Only cancel if still in a pre-fulfillment state
  IF v_order.status NOT IN ('pending', 'pending_payment', 'payment_failed') THEN
    -- Already processed or already cancelled — return success (idempotent)
    IF v_order.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_cancelled', true);
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_STATE',
      'message', format('Cannot cancel order in state: %s', v_order.status)
    );
  END IF;

  -- Release stock
  PERFORM public.release_order_stock(p_order_id, p_reason);

  -- Cancel the order
  UPDATE orders SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'new_status', 'cancelled');
END;
$$;

-- Only service_role can call this (webhook uses service_role)
REVOKE ALL ON FUNCTION public.cancel_order_payment_failed(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_order_payment_failed(UUID, TEXT) FROM authenticated;


-- ============================================================
-- Re-grant permissions (use full argument list to avoid ambiguity)
-- ============================================================
GRANT EXECUTE ON FUNCTION place_order(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_delivery_fee(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_order_core(JSONB, TEXT, NUMERIC) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
