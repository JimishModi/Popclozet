DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    IF to_regclass('public.all_products') IS NULL THEN
        RETURN;
    END IF;

    SELECT conname
    INTO v_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.all_products'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.all_products DROP CONSTRAINT %I', v_constraint_name);
    END IF;

    BEGIN
        ALTER TABLE public.all_products
        ADD CONSTRAINT all_products_status_check
        CHECK (
            status = ANY (
                ARRAY[
                    'available'::TEXT,
                    'rented'::TEXT,
                    'returned'::TEXT,
                    'washing'::TEXT,
                    'ready'::TEXT,
                    'sold'::TEXT,
                    'archived'::TEXT,
                    'lost'::TEXT,
                    'damaged'::TEXT
                ]
            )
        );
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

DROP FUNCTION IF EXISTS public.process_instant_buy(UUID, UUID[], TEXT);
DROP FUNCTION IF EXISTS public.process_instant_buy(UUID, UUID, UUID[], TEXT);

CREATE OR REPLACE FUNCTION public.process_instant_buy(
    p_source_order_id UUID,
    p_buyout_order_id UUID,
    p_item_ids UUID[],
    p_payment_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_source_order RECORD;
    v_buyout_order RECORD;
    v_selected_count INTEGER := 0;
    v_remaining_count INTEGER := 0;
    v_buyout_total NUMERIC := 0;
    v_has_pricing_plan BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated'
            USING ERRCODE = '42501';
    END IF;

    IF p_source_order_id IS NULL OR p_buyout_order_id IS NULL THEN
        RAISE EXCEPTION 'Both source and buyout order ids are required'
            USING ERRCODE = '23514';
    END IF;

    IF p_source_order_id = p_buyout_order_id THEN
        RAISE EXCEPTION 'Source and buyout order ids must be different'
            USING ERRCODE = '23514';
    END IF;

    IF COALESCE(array_length(p_item_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Select at least one item to buy instantly'
            USING ERRCODE = '23514';
    END IF;

    SELECT *
    INTO v_source_order
    FROM public.orders
    WHERE id = p_source_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source order not found: %', p_source_order_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_source_order.user_id <> v_user_id THEN
        RAISE EXCEPTION 'You can only buy items from your own return order'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_buyout_order
    FROM public.orders
    WHERE id = p_buyout_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Buyout order not found: %', p_buyout_order_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_buyout_order.user_id <> v_user_id THEN
        RAISE EXCEPTION 'You can only finalize your own buyout order'
            USING ERRCODE = '42501';
    END IF;

    CREATE TEMP TABLE tmp_instant_buy_items ON COMMIT DROP AS
    SELECT
        oi.id,
        oi.product_id,
        oi.size,
        oi.individual_id,
        GREATEST(COALESCE(oi.rental_duration_days, 1), 1) AS rental_duration_days,
        COALESCE(oi.deposit_amount, 0) AS deposit_amount,
        COALESCE(p.buy_price, 0) AS buy_price
    FROM public.order_items oi
    JOIN public.products p
      ON p.id = oi.product_id
    WHERE oi.order_id = p_source_order_id
      AND oi.id = ANY(p_item_ids);

    SELECT COUNT(*), COALESCE(SUM(buy_price), 0)
    INTO v_selected_count, v_buyout_total
    FROM tmp_instant_buy_items;

    IF v_selected_count = 0 THEN
        RAISE EXCEPTION 'No valid return items were selected for instant buy'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_selected_count <> cardinality(p_item_ids) THEN
        RAISE EXCEPTION 'One or more selected items do not belong to this return order'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM tmp_instant_buy_items
        WHERE buy_price <= 0
    ) THEN
        RAISE EXCEPTION 'Every selected item must have a valid buy price'
            USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'order_items'
          AND column_name = 'pricing_plan'
    )
    INTO v_has_pricing_plan;

    IF v_has_pricing_plan THEN
        EXECUTE $sql$
            INSERT INTO public.order_items (
                order_id,
                product_id,
                size,
                individual_id,
                rental_price,
                deposit_amount,
                rental_duration_days,
                pricing_plan
            )
            SELECT
                $1,
                product_id,
                size,
                individual_id,
                buy_price,
                0,
                rental_duration_days,
                'buy'
            FROM tmp_instant_buy_items
        $sql$
        USING p_buyout_order_id;
    ELSE
        INSERT INTO public.order_items (
            order_id,
            product_id,
            size,
            individual_id,
            rental_price,
            deposit_amount,
            rental_duration_days
        )
        SELECT
            p_buyout_order_id,
            product_id,
            size,
            individual_id,
            buy_price,
            0,
            rental_duration_days
        FROM tmp_instant_buy_items;
    END IF;

    DELETE FROM public.order_items
    WHERE id IN (
        SELECT id
        FROM tmp_instant_buy_items
    );

    IF to_regclass('public.all_products') IS NOT NULL THEN
        UPDATE public.all_products
        SET status = 'sold',
            available = FALSE
        WHERE individual_id IN (
            SELECT individual_id
            FROM tmp_instant_buy_items
            WHERE individual_id IS NOT NULL
        );
    ELSIF to_regclass('public.physical_units') IS NOT NULL THEN
        UPDATE public.physical_units
        SET status = 'sold'
        WHERE id IN (
            SELECT individual_id
            FROM tmp_instant_buy_items
            WHERE individual_id IS NOT NULL
        );
    END IF;

    UPDATE public.orders
    SET total_amount = v_buyout_total,
        order_type = 'buyout',
        status = 'completed',
        lifecycle_state = 'completed',
        payment_method = COALESCE(payment_method, 'razorpay'),
        updated_at = NOW()
    WHERE id = p_buyout_order_id;

    SELECT COUNT(*)
    INTO v_remaining_count
    FROM public.order_items
    WHERE order_id = p_source_order_id;

    IF v_remaining_count = 0 THEN
        UPDATE public.orders
        SET status = 'completed',
            lifecycle_state = 'completed',
            rider_id = NULL,
            otp_return = NULL,
            return_pickup_date = NULL,
            return_time_slot = NULL,
            updated_at = NOW()
        WHERE id = p_source_order_id;

        IF to_regclass('public.return_requests') IS NOT NULL THEN
            UPDATE public.return_requests
            SET status = 'completed',
                completed_at = NOW(),
                received_at = NOW()
            WHERE order_id = p_source_order_id;
        END IF;

        IF to_regclass('public.deliveries') IS NOT NULL THEN
            UPDATE public.deliveries
            SET status = 'cancelled',
                completed_at = COALESCE(completed_at, NOW())
            WHERE rental_id = p_source_order_id
              AND delivery_type IN ('pickup', 'return')
              AND COALESCE(status, 'pending') NOT IN ('completed', 'cancelled');
        END IF;

        IF to_regclass('public.rider_notifications') IS NOT NULL THEN
            DELETE FROM public.rider_notifications
            WHERE order_id = p_source_order_id
              AND status = 'pending';
        END IF;
    ELSE
        UPDATE public.orders
        SET updated_at = NOW()
        WHERE id = p_source_order_id;
    END IF;

    IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'instant_buy_completed',
            'order',
            p_source_order_id,
            v_user_id,
            jsonb_build_object(
                'buyout_order_id', p_buyout_order_id,
                'payment_id', p_payment_id,
                'purchased_count', v_selected_count,
                'remaining_items', v_remaining_count
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'buyout_order_id', p_buyout_order_id,
        'source_order_id', p_source_order_id,
        'purchased_count', v_selected_count,
        'remaining_items', v_remaining_count,
        'payment_id', p_payment_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_instant_buy(UUID, UUID, UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_instant_buy(UUID, UUID, UUID[], TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
