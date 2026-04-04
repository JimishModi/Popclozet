-- Fix inconsistent available state for all_products where status='available'
UPDATE public.all_products
SET available = TRUE
WHERE status = 'available' AND available = FALSE;

-- Ensure assign_order_units only trusts the status column, overriding legacy 'available' flag
CREATE OR REPLACE FUNCTION public.assign_order_units(
    p_order_id UUID,
    p_actor_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_unit RECORD;
    v_assigned_count INTEGER := 0;
BEGIN
    IF p_actor_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = p_actor_id
          AND role IN ('warehouse', 'admin')
    ) THEN
        RAISE EXCEPTION 'Only warehouse staff can assign physical units'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id
            USING ERRCODE = 'P0002';
    END IF;

    FOR v_item IN
        SELECT oi.id, oi.product_id, oi.size
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.individual_id IS NULL
        ORDER BY oi.id
    LOOP
        SELECT ap.individual_id, ap.inventory_id
        INTO v_unit
        FROM public.all_products ap
        JOIN public.inventory i ON i.id = ap.inventory_id
        WHERE i.product_id = v_item.product_id
          AND (
              v_item.size IS NULL
              OR i.size = v_item.size
              OR (i.size = 'OS' AND v_item.size = 'One Size')
              OR (i.size = 'One Size' AND v_item.size = 'OS')
          )
          -- Removed ap.available check because legacy available flag can go out of sync
          AND COALESCE(ap.status, 'available') = 'available'
        ORDER BY ap.last_washed NULLS FIRST, ap.created_at, ap.individual_id
        FOR UPDATE OF ap SKIP LOCKED
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'No available physical unit for product % size %',
                v_item.product_id,
                COALESCE(v_item.size, 'N/A')
                USING ERRCODE = '23514';
        END IF;

        UPDATE public.order_items
        SET individual_id = v_unit.individual_id
        WHERE id = v_item.id;

        UPDATE public.all_products
        SET status = 'rented',
            available = FALSE,
            last_rented = NOW(),
            times_rented = COALESCE(times_rented, 0) + 1
        WHERE individual_id = v_unit.individual_id;

        v_assigned_count := v_assigned_count + 1;
    END LOOP;

    IF v_assigned_count > 0 AND to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'assign_order_units',
            'order',
            p_order_id,
            p_actor_id,
            jsonb_build_object('assigned_count', v_assigned_count)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'orderId', p_order_id,
        'assignedCount', v_assigned_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_order_units(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
