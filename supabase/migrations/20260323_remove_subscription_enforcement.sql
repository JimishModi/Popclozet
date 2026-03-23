-- ==========================================================
-- Remove Subscription Capacity Checks from Checkout RPC
-- ==========================================================

CREATE OR REPLACE FUNCTION public.create_entitled_order(
    p_delivery_address_id UUID,
    p_items JSONB,
    p_payment_method TEXT DEFAULT NULL,
    p_order_type TEXT DEFAULT 'rental',
    p_scheduled_slot JSONB DEFAULT NULL,
    p_delivery_distance_km NUMERIC DEFAULT NULL,
    p_pop_insurance BOOLEAN DEFAULT TRUE,
    p_rental_duration_days INTEGER DEFAULT 4,
    p_delivery_eta TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_summary JSONB;
    v_has_subscription BOOLEAN := FALSE;
    v_subscription_id UUID := NULL;
    v_monthly_remaining INTEGER := 999999; -- Infined capacity
    v_concurrent_remaining INTEGER := 999999; -- Infinite capacity
    v_max_item_value NUMERIC := 999999999; -- Infinite coverage
    v_free_delivery BOOLEAN := FALSE;
    v_insurance_included BOOLEAN := FALSE;
    v_has_advance_booking BOOLEAN := TRUE; -- Default to true
    v_has_early_access BOOLEAN := TRUE; -- Default to true
    v_has_home_try_on BOOLEAN := TRUE; -- Default to true
    v_has_premium_support BOOLEAN := FALSE;
    v_requested_item_count INTEGER := 0;
    v_delivery_fee NUMERIC := 0;
    v_insurance_fee NUMERIC := 0;
    v_subtotal NUMERIC := 0;
    v_total NUMERIC := 0;
    v_total_deposit NUMERIC := 0;
    v_distance_surcharge NUMERIC := 0;
    v_support_tier TEXT := 'standard';
    v_status TEXT := 'pending_payment';
    v_rental_start_date DATE := CURRENT_DATE;
    v_rental_end_date DATE := CURRENT_DATE + 4;
    v_order_id UUID;
    v_item JSONB;
    v_qty INTEGER;
    v_product_id UUID;
    v_size TEXT;
    v_product RECORD;
    v_effective_rental_price NUMERIC;
    v_item_deposit NUMERIC;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to place an order'
            USING ERRCODE = '42501';
    END IF;

    IF p_delivery_address_id IS NULL THEN
        RAISE EXCEPTION 'A delivery address is required'
            USING ERRCODE = '23502';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.addresses a
        WHERE a.id = p_delivery_address_id
          AND a.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Delivery address does not belong to the current user'
            USING ERRCODE = '42501';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one order item is required'
            USING ERRCODE = '23514';
    END IF;

    IF p_order_type NOT IN ('rental', 'home_try_on') THEN
        RAISE EXCEPTION 'Unsupported order type: %', p_order_type
            USING ERRCODE = '23514';
    END IF;

    IF p_payment_method IS NOT NULL
       AND p_payment_method NOT IN ('upi', 'cod') THEN
        RAISE EXCEPTION 'Unsupported payment method: %', p_payment_method
            USING ERRCODE = '23514';
    END IF;

    -- SUBSCRIPTION BYPASS: We no longer look up actual subscription status
    v_has_subscription := FALSE; 
    v_subscription_id := NULL;
    v_monthly_remaining := 999999;
    v_concurrent_remaining := 999999;
    v_max_item_value := 999999999;
    v_free_delivery := FALSE;
    v_insurance_included := FALSE;
    v_has_advance_booking := TRUE;
    v_has_early_access := TRUE;
    v_has_home_try_on := TRUE;
    v_has_premium_support := FALSE;

    SELECT COALESCE(SUM(GREATEST(COALESCE((item ->> 'quantity')::INTEGER, 1), 1)), 0)
    INTO v_requested_item_count
    FROM jsonb_array_elements(p_items) AS item;

    IF p_scheduled_slot ? 'date' THEN
        v_rental_start_date := (p_scheduled_slot ->> 'date')::DATE;
    END IF;

    v_rental_end_date := v_rental_start_date + GREATEST(COALESCE(p_rental_duration_days, 4), 1);

    -- Checks for subscription capacity removed (v_has_subscription is always FALSE)

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            v_product_id := (v_item ->> 'product_id')::UUID;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'Invalid product id: %', v_item ->> 'product_id'
                    USING ERRCODE = '22P02';
        END;

        v_qty := GREATEST(COALESCE((v_item ->> 'quantity')::INTEGER, 1), 1);
        v_size := COALESCE(NULLIF(v_item ->> 'size', ''), 'S');

        SELECT p.id,
               p.name,
               COALESCE(p.rental_price * 5, p.deposit_amount * 3, 0) AS mrp, -- Fallback value lookup
               p.deposit_amount,
               p.early_access_until,
               p.is_available
        INTO v_product
        FROM public.products p
        WHERE p.id = v_product_id;

        IF NOT FOUND OR COALESCE(v_product.is_available, FALSE) = FALSE THEN
            RAISE EXCEPTION 'Product is not currently available'
                USING ERRCODE = '23514';
        END IF;

        -- Early access check (bypass for now since we removed subscriptions)
        -- IF v_product.early_access_until IS NOT NULL AND v_product.early_access_until > NOW() THEN ...

        v_effective_rental_price := CASE 
            WHEN (SELECT pg_typeof(p.rental_price) FROM public.products p WHERE p.id = v_product_id) = 'numeric'::regtype 
            THEN (SELECT p.rental_price FROM public.products p WHERE p.id = v_product_id)
            ELSE 0 
        END;
        
        -- Better price lookup
        SELECT rental_price INTO v_effective_rental_price FROM public.products WHERE id = v_product_id;

        v_item_deposit := COALESCE(v_product.deposit_amount, ROUND(v_effective_rental_price * 0.3));

        v_subtotal := v_subtotal + (v_effective_rental_price * v_qty);
        v_total_deposit := v_total_deposit + (v_item_deposit * v_qty);
    END LOOP;

    IF p_delivery_distance_km IS NOT NULL AND p_delivery_distance_km > 6 THEN
        v_distance_surcharge := ROUND(p_delivery_distance_km - 6) * 10;
    END IF;

    IF p_order_type = 'home_try_on' THEN
        v_delivery_fee := 0;
    ELSE
        v_delivery_fee := 40 + v_distance_surcharge;
    END IF;

    v_insurance_fee := CASE
        WHEN COALESCE(p_pop_insurance, TRUE) THEN 200
        ELSE 0
    END;

    v_total := v_subtotal + v_delivery_fee + v_insurance_fee;
    v_support_tier := 'standard';
    v_status := CASE
        WHEN p_payment_method = 'cod' THEN 'pending'
        ELSE 'pending_payment'
    END;

    INSERT INTO public.orders (
        user_id,
        delivery_address_id,
        rental_start_date,
        rental_end_date,
        total_amount,
        deposit_amount,
        status,
        delivery_eta,
        payment_method,
        delivery_fee,
        subscription_id,
        order_type,
        scheduled_slot,
        support_tier
    ) VALUES (
        v_user_id,
        p_delivery_address_id,
        v_rental_start_date,
        v_rental_end_date,
        v_total,
        v_total_deposit,
        v_status,
        COALESCE(p_delivery_eta, NOW() + INTERVAL '60 minutes'),
        p_payment_method,
        v_delivery_fee,
        NULL, -- Always NULL for non-subscription
        p_order_type,
        p_scheduled_slot,
        v_support_tier
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        v_qty := GREATEST(COALESCE((v_item ->> 'quantity')::INTEGER, 1), 1);
        v_size := COALESCE(NULLIF(v_item ->> 'size', ''), 'S');
        
        SELECT rental_price INTO v_effective_rental_price FROM public.products WHERE id = v_product_id;
        v_item_deposit := COALESCE((SELECT deposit_amount FROM public.products WHERE id = v_product_id), ROUND(v_effective_rental_price * 0.3));

        FOR i IN 1..v_qty LOOP
            INSERT INTO public.order_items (
                order_id,
                product_id,
                size,
                rental_price,
                deposit_amount,
                rental_duration_days
            ) VALUES (
                v_order_id,
                v_product_id,
                v_size,
                v_effective_rental_price,
                v_item_deposit,
                GREATEST(COALESCE(p_rental_duration_days, 4), 1)
            );
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'orderId', v_order_id,
        'totalAmount', v_total,
        'subtotal', v_subtotal,
        'deliveryFee', v_delivery_fee,
        'insuranceFee', v_insurance_fee,
        'depositAmount', v_total_deposit,
        'subscriptionId', NULL,
        'supportTier', v_support_tier,
        'orderType', p_order_type
    );
END;
$$;
