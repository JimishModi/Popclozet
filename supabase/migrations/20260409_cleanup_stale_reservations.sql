-- Auto-cleanup stale stock reservations that were never released.
-- Covers edge cases: Razorpay popup closed, network failure on cancel, etc.

-- 1. Function to release stale reservations
CREATE OR REPLACE FUNCTION public.cleanup_stale_reservations(
  p_max_age_minutes INT DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_released INT := 0;
  v_order_status TEXT;
BEGIN
  FOR v_reservation IN
    SELECT r.id, r.order_id, r.variant_id, r.quantity
    FROM public.order_stock_reservations r
    WHERE r.released_at IS NULL
      AND r.created_at < NOW() - (p_max_age_minutes || ' minutes')::INTERVAL
    ORDER BY r.created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Check if the order is still active (confirmed/packed/dispatched/delivered)
    SELECT COALESCE(status, lifecycle_state) INTO v_order_status
    FROM public.orders
    WHERE id = v_reservation.order_id;

    -- Skip if order is in an active fulfillment state
    IF v_order_status IN (
      'confirmed', 'packed', 'ready_for_pickup', 'rider_assigned',
      'driver_arrived_warehouse', 'order_picked_up', 'dispatched',
      'out_for_delivery', 'delivered', 'in_use'
    ) THEN
      CONTINUE;
    END IF;

    -- Release the reservation
    PERFORM public.release_order_stock(v_reservation.order_id, 'stale_auto_cleanup');

    -- If order is still pending/pending_payment, cancel it too
    IF v_order_status IN ('pending', 'pending_payment') THEN
      UPDATE public.orders
      SET status = 'cancelled',
          lifecycle_state = 'cancelled',
          updated_at = NOW()
      WHERE id = v_reservation.order_id;
    END IF;

    v_released := v_released + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released,
    'max_age_minutes', p_max_age_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_reservations(INT) TO service_role;

-- 2. pg_cron job: run every 15 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_stale_reservations');
    PERFORM cron.schedule(
      'cleanup_stale_reservations',
      '*/15 * * * *',
      $$SELECT public.cleanup_stale_reservations(30)$$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule cleanup_stale_reservations() externally every 15 minutes.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
