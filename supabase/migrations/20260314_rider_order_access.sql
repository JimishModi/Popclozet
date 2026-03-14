-- =====================================================
-- RIDER RLS POLICIES
-- Migration: 20260314_rider_order_access.sql
-- Purpose: Allow riders to see available orders (ready_for_pickup)
--          and orders assigned to them, so the rider app works.
--
-- Without these policies, riders get 0 rows from all order queries
-- because the only SELECT policy was auth.uid() = user_id (customers).
-- =====================================================

-- 1. Riders can SELECT orders that are ready for pickup (unassigned)
--    OR already assigned to them.
CREATE POLICY "Riders can view available and assigned orders"
  ON public.orders FOR SELECT
  USING (
    -- Rider can see orders assigned to them
    rider_id = auth.uid()
    OR
    -- Rider can see unassigned orders ready for pickup
    (
      rider_id IS NULL
      AND status IN ('ready_for_pickup')
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid()
        AND role = 'rider'
      )
    )
  );

-- 2. Riders can UPDATE orders assigned to them
--    (needed for claim_order and status-independent column updates)
CREATE POLICY "Riders can update assigned orders"
  ON public.orders FOR UPDATE
  USING (
    rider_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'rider'
    )
  );

-- 3. Riders need to read delivery addresses for orders they can see
--    (the rider app joins addresses:delivery_address_id)
CREATE POLICY "Riders can view addresses for their orders"
  ON public.addresses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.delivery_address_id = addresses.id
      AND (
        orders.rider_id = auth.uid()
        OR (orders.rider_id IS NULL AND orders.status IN ('ready_for_pickup'))
      )
    )
  );

-- 4. Riders need to read order_items for orders they can see
CREATE POLICY "Riders can view items for their orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.rider_id = auth.uid()
        OR (orders.rider_id IS NULL AND orders.status IN ('ready_for_pickup'))
      )
    )
  );

-- 5. Riders need to upsert/read their own location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Riders can upsert their own location' AND tablename = 'rider_locations'
  ) THEN
    CREATE POLICY "Riders can upsert their own location"
      ON public.rider_locations FOR INSERT
      WITH CHECK (rider_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Riders can update their own location' AND tablename = 'rider_locations'
  ) THEN
    CREATE POLICY "Riders can update their own location"
      ON public.rider_locations FOR UPDATE
      USING (rider_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Riders can view their own location' AND tablename = 'rider_locations'
  ) THEN
    CREATE POLICY "Riders can view their own location"
      ON public.rider_locations FOR SELECT
      USING (rider_id = auth.uid());
  END IF;
END $$;

-- 6. Riders need to read notifications table to send messages to customers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "Riders can insert notifications"
      ON public.notifications FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid()
          AND role = ''rider''
        )
      )';
  END IF;
END $$;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
