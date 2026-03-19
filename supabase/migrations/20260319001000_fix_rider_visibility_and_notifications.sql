-- =====================================================
-- Fix rider visibility and notifications for ready orders
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_rider_account(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = p_user_id
          AND p.role = 'rider'
    )
    OR EXISTS (
        SELECT 1
        FROM public.riders r
        WHERE r.id = p_user_id
           OR r.user_id = p_user_id
    );
$$;

DROP POLICY IF EXISTS "Riders can view available and assigned orders" ON public.orders;
CREATE POLICY "Riders can view available and assigned orders"
    ON public.orders
    FOR SELECT
    USING (
        rider_id = auth.uid()
        OR (
            rider_id IS NULL
            AND status IN ('ready_for_pickup', 'return_scheduled')
            AND public.is_rider_account(auth.uid())
        )
    );

DROP POLICY IF EXISTS "Riders can view addresses for their orders" ON public.addresses;
CREATE POLICY "Riders can view addresses for their orders"
    ON public.addresses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.orders
            WHERE orders.delivery_address_id = addresses.id
              AND (
                  orders.rider_id = auth.uid()
                  OR (
                      orders.rider_id IS NULL
                      AND orders.status IN ('ready_for_pickup', 'return_scheduled')
                      AND public.is_rider_account(auth.uid())
                  )
              )
        )
        OR EXISTS (
            SELECT 1
            FROM public.return_requests
            JOIN public.orders ON orders.id = return_requests.order_id
            WHERE return_requests.pickup_address_id = addresses.id
              AND (
                  orders.rider_id = auth.uid()
                  OR (
                      orders.rider_id IS NULL
                      AND orders.status = 'return_scheduled'
                      AND public.is_rider_account(auth.uid())
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Riders can view items for their orders" ON public.order_items;
CREATE POLICY "Riders can view items for their orders"
    ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.orders
            WHERE orders.id = order_items.order_id
              AND (
                  orders.rider_id = auth.uid()
                  OR (
                      orders.rider_id IS NULL
                      AND orders.status IN ('ready_for_pickup', 'return_scheduled')
                      AND public.is_rider_account(auth.uid())
                  )
              )
        )
    );

CREATE OR REPLACE FUNCTION public.notify_order_to_available_riders(
    p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.rider_notifications (order_id, rider_id, status, created_at)
    SELECT
        p_order_id,
        rider_pool.rider_id,
        'pending',
        NOW()
    FROM (
        SELECT DISTINCT p.user_id AS rider_id
        FROM public.profiles p
        WHERE p.role = 'rider'
        UNION
        SELECT DISTINCT COALESCE(r.user_id, r.id) AS rider_id
        FROM public.riders r
    ) AS rider_pool
    JOIN public.orders o ON o.id = p_order_id
    WHERE o.rider_id IS NULL
      AND o.status IN ('ready_for_pickup', 'return_scheduled')
      AND NOT EXISTS (
          SELECT 1
          FROM public.order_cancellations oc
          WHERE oc.order_id = p_order_id
            AND oc.rider_id = rider_pool.rider_id
      )
    ON CONFLICT (order_id, rider_id)
    DO UPDATE SET
        status = 'pending',
        created_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_order_to_riders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.rider_id IS NULL
       AND NEW.status IN ('ready_for_pickup', 'return_scheduled')
       AND (
           OLD.status IS DISTINCT FROM NEW.status
           OR OLD.rider_id IS DISTINCT FROM NEW.rider_id
       ) THEN
        PERFORM public.notify_order_to_available_riders(NEW.id);
    END IF;

    RETURN NEW;
END;
$$;

INSERT INTO public.rider_notifications (order_id, rider_id, status, created_at)
SELECT
    o.id,
    rider_pool.rider_id,
    'pending',
    NOW()
FROM public.orders o
JOIN (
    SELECT DISTINCT p.user_id AS rider_id
    FROM public.profiles p
    WHERE p.role = 'rider'
    UNION
    SELECT DISTINCT COALESCE(r.user_id, r.id) AS rider_id
    FROM public.riders r
) AS rider_pool
    ON TRUE
WHERE o.rider_id IS NULL
  AND o.status IN ('ready_for_pickup', 'return_scheduled')
  AND NOT EXISTS (
      SELECT 1
      FROM public.order_cancellations oc
      WHERE oc.order_id = o.id
        AND oc.rider_id = rider_pool.rider_id
  )
ON CONFLICT (order_id, rider_id)
DO UPDATE SET
    status = 'pending',
    created_at = NOW();

NOTIFY pgrst, 'reload schema';
