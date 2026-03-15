-- =====================================================
-- REAL-TIME ORDER ASSIGNMENT
-- =====================================================

-- 1. Create tables for tracking Notifications & Cancellations

CREATE TABLE IF NOT EXISTS public.rider_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, rider_id)
);

CREATE TABLE IF NOT EXISTS public.order_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.rider_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Riders can view their own notifications" ON public.rider_notifications FOR SELECT USING (rider_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "Riders can update their own notifications" ON public.rider_notifications FOR UPDATE USING (rider_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.order_cancellations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Riders can view their cancellations" ON public.order_cancellations FOR SELECT USING (rider_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rider_notifications;

-- 2. Add claim_attempts column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS claim_attempts INTEGER DEFAULT 0;

-- 3. Broadcast Trigger
-- When an order hits ready_for_pickup, notify all active riders (minus cancellations)
CREATE OR REPLACE FUNCTION public.broadcast_order_to_riders()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'ready_for_pickup' AND NEW.status = 'ready_for_pickup' AND NEW.rider_id IS NULL THEN
        -- Insert a notification for every rider who is active and hasn't canceled this order
        INSERT INTO public.rider_notifications (order_id, rider_id)
        SELECT NEW.id, p.user_id
        FROM public.profiles p
        WHERE p.role = 'rider'
          AND NOT EXISTS (
              SELECT 1 FROM public.order_cancellations oc 
              WHERE oc.order_id = NEW.id AND oc.rider_id = p.user_id
          )
        ON CONFLICT (order_id, rider_id) DO UPDATE SET status = 'pending', created_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_broadcast_order_to_riders ON public.orders;
CREATE TRIGGER tr_broadcast_order_to_riders
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_order_to_riders();

-- 4. Release Order RPC
CREATE OR REPLACE FUNCTION public.release_order(
  p_order_id UUID,
  p_rider_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current_rider_id UUID;
BEGIN
  -- Verify ownership
  SELECT rider_id INTO v_current_rider_id
  FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF v_current_rider_id != p_rider_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot release an order you do not own');
  END IF;

  -- Record cancellation
  INSERT INTO public.order_cancellations (order_id, rider_id, reason)
  VALUES (p_order_id, p_rider_id, p_reason);

  -- Let it go back to the pool
  UPDATE orders 
  SET rider_id = NULL,
      status = 'ready_for_pickup',
      claim_attempts = COALESCE(claim_attempts, 0) + 1,
      updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Delete tracking record (if any) so customer tracking goes back to searching
  DELETE FROM public.delivery_tracking WHERE order_id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update Claim Order RPC
CREATE OR REPLACE FUNCTION public.claim_order(
  p_order_id UUID,
  p_rider_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_order_rider_id UUID;
  v_rider_name TEXT;
BEGIN
  -- Get rider info
  SELECT full_name INTO v_rider_name FROM profiles WHERE user_id = p_rider_id;

  SELECT status, rider_id INTO v_current_status, v_order_rider_id
  FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order does not exist');
  END IF;
  
  IF v_current_status != 'ready_for_pickup' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order is not available for pickup');
  END IF;

  IF v_order_rider_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order already claimed by another rider');
  END IF;

  -- Assign rider and transition state
  UPDATE orders 
  SET rider_id = p_rider_id, 
      status = 'driver_arrived_warehouse',
      updated_at = NOW() 
  WHERE id = p_order_id;

  -- Initialize tracking
  INSERT INTO delivery_tracking (order_id, driver_name, is_active, updated_at)
  VALUES (p_order_id, COALESCE(v_rider_name, 'Rider'), true, NOW())
  ON CONFLICT (order_id) DO UPDATE 
  SET driver_name = COALESCE(v_rider_name, EXCLUDED.driver_name),
      is_active = true,
      updated_at = NOW();
      
  -- Clean up notifications for this order so it disappears from all rider inboxes
  DELETE FROM public.rider_notifications WHERE order_id = p_order_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
