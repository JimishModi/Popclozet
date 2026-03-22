-- =====================================================
-- Backfill rider notifications for currently available rider orders
-- =====================================================

INSERT INTO public.rider_notifications (order_id, rider_id, status, created_at)
SELECT
    o.id,
    p.user_id,
    'pending',
    NOW()
FROM public.orders o
JOIN public.profiles p
    ON p.role = 'rider'
WHERE o.rider_id IS NULL
  AND o.status IN ('ready_for_pickup', 'return_scheduled')
  AND NOT EXISTS (
      SELECT 1
      FROM public.order_cancellations oc
      WHERE oc.order_id = o.id
        AND oc.rider_id = p.user_id
  )
ON CONFLICT (order_id, rider_id)
DO UPDATE SET
    status = 'pending',
    created_at = NOW();

NOTIFY pgrst, 'reload schema';
