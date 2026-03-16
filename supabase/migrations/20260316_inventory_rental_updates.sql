-- =====================================================
-- INVENTORY SYNC & RENTAL TIMER UPDATES
-- =====================================================

-- 1. Upgrade rental date columns to TIMESTAMPTZ for precision
ALTER TABLE public.orders 
  ALTER COLUMN rental_start_date TYPE TIMESTAMPTZ USING rental_start_date::TIMESTAMPTZ,
  ALTER COLUMN rental_end_date TYPE TIMESTAMPTZ USING rental_end_date::TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_pickup_date DATE,
  ADD COLUMN IF NOT EXISTS return_time_slot TEXT;

-- 2. Function to deduct inventory when order is dispatched
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when moving to ''out_for_delivery'' (dispatched)
    IF (NEW.status = 'out_for_delivery' AND OLD.status != 'out_for_delivery') THEN
        -- Find all items in the order and decrement available_stock in inventory
        -- We match by product_id and size.
        UPDATE public.inventory i
        SET available_stock = GREATEST(0, i.available_stock - oi.item_count)
        FROM (
            SELECT product_id, size, COUNT(*) as item_count
            FROM public.order_items
            WHERE order_id = NEW.id
            GROUP BY product_id, size
        ) oi
        WHERE i.product_id = oi.product_id AND i.size = oi.size;
        
        -- Optional: Log activity
        INSERT INTO public.warehouse_activity_log (action, entity_type, entity_id, details)
        VALUES ('auto_inventory_deduction', 'order', NEW.id, jsonb_build_object('status', 'out_for_delivery'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to orders
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_dispatch ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_dispatch
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.deduct_inventory_on_dispatch();

-- 4. Refine verify_order_otp to start the rental timer
CREATE OR REPLACE FUNCTION public.verify_order_otp(
  p_order_id UUID,
  p_otp_code TEXT,
  p_otp_type TEXT,
  p_actor_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order_otp TEXT;
  v_duration INTEGER;
  v_user_id UUID;
BEGIN
  -- Get order info
  SELECT 
    CASE WHEN p_otp_type = 'delivery' THEN otp_delivery ELSE otp_return END,
    user_id
  INTO v_order_otp, v_user_id
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF v_order_otp IS NULL OR v_order_otp != p_otp_code THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid code');
  END IF;

  IF p_otp_type = 'delivery' THEN
    -- Get max duration from items
    SELECT COALESCE(MAX(rental_duration_days), 2) INTO v_duration FROM order_items WHERE order_id = p_order_id;
    
    -- Start Timer & Set Delivered
    UPDATE orders SET 
      status = 'delivered',
      rental_start_date = NOW(),
      rental_end_date = NOW() + (v_duration || ' days')::INTERVAL,
      updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Delivery verified. Rental started!');
  ELSE
    -- Return flow
    UPDATE orders SET status = 'returned', updated_at = NOW() WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'message', 'Return verified');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Reload Schema
NOTIFY pgrst, 'reload schema';
