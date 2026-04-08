-- Release stock that was reserved by cancelled/unpaid checkout attempts before
-- the Razorpay cancel flow consistently used cancel_order_safe().
--
-- This is intentionally idempotent:
-- - release_order_stock() only releases rows with released_at IS NULL.
-- - the fallback inventory restore is capped at total_stock.
-- - orders with any Razorpay payment id or completed/successful payment are skipped.

-- Make sure the cancellation trigger exists in environments where the older
-- inventory trigger was never created or was dropped during manual testing.
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_dispatch ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_dispatch
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_inventory_on_dispatch();

DO $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_has_reservations BOOLEAN := FALSE;
  v_has_rented_stock BOOLEAN := FALSE;
  v_fallback_count INT := 0;
BEGIN
  IF to_regclass('public.orders') IS NULL
     OR to_regclass('public.order_items') IS NULL
     OR to_regclass('public.inventory') IS NULL THEN
    RAISE NOTICE 'Skipping cancelled unpaid stock release: required tables are missing.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory'
      AND column_name = 'rented_stock'
  )
  INTO v_has_rented_stock;

  FOR v_order IN
    SELECT o.id
    FROM public.orders o
    WHERE o.status = 'cancelled'
      AND NOT EXISTS (
        SELECT 1
        FROM public.payments p
        WHERE p.order_id = o.id
          AND (
            p.razorpay_payment_id IS NOT NULL
            OR COALESCE(p.status, '') IN ('completed', 'success', 'succeeded', 'paid', 'captured')
          )
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    v_has_reservations := FALSE;

    IF to_regclass('public.order_stock_reservations') IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.order_stock_reservations
        WHERE order_id = v_order.id
      )
      INTO v_has_reservations;

      PERFORM public.release_order_stock(v_order.id, 'cancelled_unpaid_backfill');
    END IF;

    -- Older broken attempts could reserve inventory but fail before durable
    -- reservation rows were persisted. In that case, reconstruct a conservative
    -- release from the order item product+size. The LEAST(total_stock, ...) cap
    -- prevents over-restoring already healthy rows.
    IF NOT v_has_reservations THEN
      FOR v_item IN
        SELECT oi.product_id, COALESCE(NULLIF(oi.size, ''), 'One Size') AS size
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id
      LOOP
        IF v_has_rented_stock THEN
          UPDATE public.inventory i
          SET available_stock = i.available_stock + 1,
              rented_stock = i.rented_stock - 1
          WHERE i.product_id = v_item.product_id
            AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item.size
            AND i.rented_stock > 0;
        ELSE
          UPDATE public.inventory i
          SET available_stock = LEAST(i.total_stock, i.available_stock + 1)
          WHERE i.product_id = v_item.product_id
            AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item.size
            AND i.available_stock < i.total_stock;
        END IF;

        IF FOUND THEN
          v_fallback_count := v_fallback_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Cancelled unpaid stock backfill completed. Fallback inventory rows restored: %', v_fallback_count;
END $$;

NOTIFY pgrst, 'reload schema';
