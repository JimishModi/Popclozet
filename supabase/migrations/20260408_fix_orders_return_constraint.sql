ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status = ANY (
    ARRAY[
      'pending'::text, 'pending_payment'::text, 'payment_failed'::text,
      'placed'::text, 'confirmed'::text, 'preparing'::text, 'packed'::text,
      'ready_for_pickup'::text, 'rider_assigned'::text, 'driver_arrived_warehouse'::text,
      'order_picked_up'::text, 'dispatched'::text, 'out_for_delivery'::text, 'delivered'::text,
      'in_use'::text, 'pickup_scheduled'::text, 'picked_up'::text,
      'return_requested'::text, 'return_scheduled'::text, 'return_dispatched'::text,
      'return_picked_up'::text, 'return_at_warehouse'::text, 'return_completed'::text,
      'returned'::text, 'completed'::text, 'cancelled'::text
    ]
  )
);
