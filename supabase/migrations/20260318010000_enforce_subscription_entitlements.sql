-- =====================================================
-- Enforce Subscription Entitlements End-to-End
-- =====================================================

DO $$
DECLARE
    v_id_data_type TEXT;
BEGIN
    SELECT data_type
    INTO v_id_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'id';

    IF v_id_data_type IS NOT NULL AND v_id_data_type <> 'text' THEN
        ALTER TABLE public.subscription_plans
        ALTER COLUMN id DROP IDENTITY IF EXISTS;

        ALTER TABLE public.subscription_plans
        ALTER COLUMN id DROP DEFAULT;

        ALTER TABLE public.subscription_plans
        ALTER COLUMN id TYPE TEXT USING id::text;
    END IF;
END $$;

-- 1) Extend subscription plans and products with explicit entitlement fields
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS concurrent_items INTEGER;

UPDATE public.subscription_plans
SET concurrent_items = CASE id
    WHEN 'essential' THEN 2
    WHEN 'standard' THEN 4
    WHEN 'pro' THEN 6
    ELSE COALESCE(concurrent_items, monthly_items, 0)
END
WHERE concurrent_items IS NULL;

ALTER TABLE public.subscription_plans
ALTER COLUMN concurrent_items SET NOT NULL;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS early_access_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_early_access_until
ON public.products(early_access_until)
WHERE early_access_until IS NOT NULL;

-- 2) Extend orders and support chats to snapshot entitlement-backed behavior
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'rental';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS scheduled_slot JSONB;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS support_tier TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_subscription_id
ON public.orders(subscription_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.orders'::regclass
          AND conname = 'orders_order_type_check'
    ) THEN
        ALTER TABLE public.orders
        ADD CONSTRAINT orders_order_type_check
        CHECK (order_type IN ('rental', 'home_try_on', 'delivery', 'pickup', 'return'))
        NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.orders'::regclass
          AND conname = 'orders_support_tier_check'
    ) THEN
        ALTER TABLE public.orders
        ADD CONSTRAINT orders_support_tier_check
        CHECK (support_tier IN ('standard', 'premium'))
        NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.order_support_chats') IS NOT NULL THEN
        ALTER TABLE public.order_support_chats
        ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'standard';

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.order_support_chats'::regclass
              AND conname = 'order_support_chats_priority_check'
        ) THEN
            ALTER TABLE public.order_support_chats
            ADD CONSTRAINT order_support_chats_priority_check
            CHECK (priority IN ('standard', 'premium'))
            NOT VALID;
        END IF;
    END IF;
END $$;

-- 3) Helper functions for plan feature lookups and pricing
CREATE OR REPLACE FUNCTION public.plan_has_feature(p_plan_id TEXT, p_feature_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.subscription_plans sp,
             LATERAL jsonb_array_elements(sp.features) AS feature
        WHERE sp.id = p_plan_id
          AND COALESCE((feature ->> 'included')::BOOLEAN, FALSE) = TRUE
          AND feature ->> 'id' = p_feature_id
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_subscription_feature(p_user_id UUID, p_feature_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_subscriptions us
        JOIN public.subscription_plans sp ON sp.id = us.plan_id
        WHERE us.user_id = p_user_id
          AND us.status IN ('active', 'cancelled')
          AND us.current_period_end >= NOW()
          AND public.plan_has_feature(sp.id, p_feature_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.calculate_effective_rental_price(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rental_price NUMERIC;
    v_discount_type TEXT;
    v_discount_value NUMERIC;
BEGIN
    SELECT p.rental_price,
           pd.discount_type,
           pd.discount_value
    INTO v_rental_price, v_discount_type, v_discount_value
    FROM public.products p
    LEFT JOIN LATERAL (
        SELECT discount_type, discount_value
        FROM public.product_discounts
        WHERE product_id = p.id
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT 1
    ) pd ON TRUE
    WHERE p.id = p_product_id;

    IF v_rental_price IS NULL THEN
        RETURN 0;
    END IF;

    IF v_discount_type = 'percentage' THEN
        RETURN ROUND(GREATEST(0, v_rental_price - (v_rental_price * (v_discount_value / 100.0))));
    ELSIF v_discount_type = 'fixed_amount' THEN
        RETURN ROUND(GREATEST(0, v_rental_price - v_discount_value));
    END IF;

    RETURN ROUND(v_rental_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_plan_value(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_mrp BOOLEAN := FALSE;
    v_value NUMERIC := 0;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'mrp'
    )
    INTO v_has_mrp;

    IF v_has_mrp THEN
        EXECUTE '
            SELECT COALESCE(mrp, rental_price * 5, deposit_amount * 3, 0)
            FROM public.products
            WHERE id = $1
        '
        INTO v_value
        USING p_product_id;
    ELSE
        SELECT COALESCE(rental_price * 5, deposit_amount * 3, 0)
        INTO v_value
        FROM public.products
        WHERE id = p_product_id;
    END IF;

    RETURN COALESCE(v_value, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_subscription_feature(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_effective_rental_price(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_product_plan_value(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_subscription_feature(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_effective_rental_price(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_plan_value(UUID) TO authenticated, anon;

-- 4) Harden product visibility with early-access gating
DROP POLICY IF EXISTS "Anyone can view available products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view entitled products" ON public.products;

CREATE POLICY "Anyone can view entitled products"
    ON public.products
    FOR SELECT
    USING (
        is_available = TRUE
        AND (
            early_access_until IS NULL
            OR early_access_until <= NOW()
            OR public.user_has_subscription_feature(auth.uid(), 'early_access')
        )
    );

-- 5) Summary RPC consumed by the customer app
CREATE OR REPLACE FUNCTION public.get_checkout_entitlement_summary(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub public.user_subscriptions%ROWTYPE;
    v_plan public.subscription_plans%ROWTYPE;
    v_monthly_used INTEGER := 0;
    v_concurrent_used INTEGER := 0;
    v_concurrent_limit INTEGER := 0;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'hasActiveSubscription', FALSE,
            'subscriptionId', NULL,
            'planId', NULL,
            'planName', NULL,
            'monthlyItems', 0,
            'concurrentItems', 0,
            'monthlyUsed', 0,
            'concurrentUsed', 0,
            'remainingMonthly', 0,
            'remainingConcurrent', 0,
            'maxItemValue', 0,
            'freeDelivery', FALSE,
            'insuranceIncluded', FALSE,
            'hasAdvanceBooking', FALSE,
            'hasEarlyAccess', FALSE,
            'hasFreeHomeTryOn', FALSE,
            'hasPremiumSupport', FALSE
        );
    END IF;

    SELECT *
    INTO v_sub
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'cancelled')
      AND current_period_end >= NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'hasActiveSubscription', FALSE,
            'subscriptionId', NULL,
            'planId', NULL,
            'planName', NULL,
            'monthlyItems', 0,
            'concurrentItems', 0,
            'monthlyUsed', 0,
            'concurrentUsed', 0,
            'remainingMonthly', 0,
            'remainingConcurrent', 0,
            'maxItemValue', 0,
            'freeDelivery', FALSE,
            'insuranceIncluded', FALSE,
            'hasAdvanceBooking', FALSE,
            'hasEarlyAccess', FALSE,
            'hasFreeHomeTryOn', FALSE,
            'hasPremiumSupport', FALSE
        );
    END IF;

    SELECT *
    INTO v_plan
    FROM public.subscription_plans
    WHERE id = v_sub.plan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'hasActiveSubscription', FALSE,
            'subscriptionId', v_sub.id,
            'planId', v_sub.plan_id,
            'planName', NULL,
            'monthlyItems', 0,
            'concurrentItems', 0,
            'monthlyUsed', 0,
            'concurrentUsed', 0,
            'remainingMonthly', 0,
            'remainingConcurrent', 0,
            'maxItemValue', 0,
            'freeDelivery', FALSE,
            'insuranceIncluded', FALSE,
            'hasAdvanceBooking', FALSE,
            'hasEarlyAccess', FALSE,
            'hasFreeHomeTryOn', FALSE,
            'hasPremiumSupport', FALSE
        );
    END IF;

    SELECT COALESCE(COUNT(oi.id), 0)::INTEGER
    INTO v_monthly_used
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.user_id = p_user_id
      AND o.subscription_id = v_sub.id
      AND o.status <> 'cancelled'
      AND o.created_at >= COALESCE(v_sub.current_period_start, v_sub.created_at, NOW())
      AND o.created_at < v_sub.current_period_end;

    SELECT COALESCE(COUNT(oi.id), 0)::INTEGER
    INTO v_concurrent_used
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.user_id = p_user_id
      AND o.status NOT IN ('cancelled', 'completed', 'returned', 'return_completed');

    v_concurrent_limit := COALESCE(v_plan.concurrent_items, v_plan.monthly_items, 0);

    RETURN jsonb_build_object(
        'hasActiveSubscription', TRUE,
        'subscriptionId', v_sub.id,
        'planId', v_plan.id,
        'planName', v_plan.name,
        'monthlyItems', v_plan.monthly_items,
        'concurrentItems', v_concurrent_limit,
        'monthlyUsed', v_monthly_used,
        'concurrentUsed', v_concurrent_used,
        'remainingMonthly', GREATEST(v_plan.monthly_items - v_monthly_used, 0),
        'remainingConcurrent', GREATEST(v_concurrent_limit - v_concurrent_used, 0),
        'maxItemValue', COALESCE(v_plan.max_item_value, 0),
        'freeDelivery', COALESCE(v_plan.free_delivery, FALSE),
        'insuranceIncluded', COALESCE(v_plan.insurance_included, FALSE),
        'hasAdvanceBooking', public.plan_has_feature(v_plan.id, 'advance_booking'),
        'hasEarlyAccess', public.plan_has_feature(v_plan.id, 'early_access'),
        'hasFreeHomeTryOn', public.plan_has_feature(v_plan.id, 'free_home_try_on'),
        'hasPremiumSupport', public.plan_has_feature(v_plan.id, 'premium_support')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_checkout_entitlement_summary(UUID) TO authenticated;

-- 6) Authoritative order-creation RPC
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
    v_monthly_remaining INTEGER := 0;
    v_concurrent_remaining INTEGER := 0;
    v_max_item_value NUMERIC := 0;
    v_free_delivery BOOLEAN := FALSE;
    v_insurance_included BOOLEAN := FALSE;
    v_has_advance_booking BOOLEAN := FALSE;
    v_has_early_access BOOLEAN := FALSE;
    v_has_home_try_on BOOLEAN := FALSE;
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

    SELECT public.get_checkout_entitlement_summary(v_user_id) INTO v_summary;

    v_has_subscription := COALESCE((v_summary ->> 'hasActiveSubscription')::BOOLEAN, FALSE);
    IF v_has_subscription THEN
        v_subscription_id := (v_summary ->> 'subscriptionId')::UUID;
        v_monthly_remaining := COALESCE((v_summary ->> 'remainingMonthly')::INTEGER, 0);
        v_concurrent_remaining := COALESCE((v_summary ->> 'remainingConcurrent')::INTEGER, 0);
        v_max_item_value := COALESCE((v_summary ->> 'maxItemValue')::NUMERIC, 0);
        v_free_delivery := COALESCE((v_summary ->> 'freeDelivery')::BOOLEAN, FALSE);
        v_insurance_included := COALESCE((v_summary ->> 'insuranceIncluded')::BOOLEAN, FALSE);
        v_has_advance_booking := COALESCE((v_summary ->> 'hasAdvanceBooking')::BOOLEAN, FALSE);
        v_has_early_access := COALESCE((v_summary ->> 'hasEarlyAccess')::BOOLEAN, FALSE);
        v_has_home_try_on := COALESCE((v_summary ->> 'hasFreeHomeTryOn')::BOOLEAN, FALSE);
        v_has_premium_support := COALESCE((v_summary ->> 'hasPremiumSupport')::BOOLEAN, FALSE);
    END IF;

    SELECT COALESCE(SUM(GREATEST(COALESCE((item ->> 'quantity')::INTEGER, 1), 1)), 0)
    INTO v_requested_item_count
    FROM jsonb_array_elements(p_items) AS item;

    IF p_order_type = 'home_try_on' AND NOT v_has_home_try_on THEN
        RAISE EXCEPTION 'Your current plan does not include free home try-on'
            USING ERRCODE = '23514';
    END IF;

    IF p_scheduled_slot IS NOT NULL AND NOT (v_has_advance_booking OR p_order_type = 'home_try_on') THEN
        RAISE EXCEPTION 'Your current plan does not include scheduled-slot booking'
            USING ERRCODE = '23514';
    END IF;

    IF p_order_type = 'home_try_on' AND p_scheduled_slot IS NULL THEN
        RAISE EXCEPTION 'Home try-on requires a scheduled slot'
            USING ERRCODE = '23514';
    END IF;

    IF p_scheduled_slot ? 'date' THEN
        v_rental_start_date := (p_scheduled_slot ->> 'date')::DATE;
    END IF;

    v_rental_end_date := v_rental_start_date + GREATEST(COALESCE(p_rental_duration_days, 4), 1);

    IF v_has_subscription THEN
        IF v_requested_item_count > v_monthly_remaining THEN
            RAISE EXCEPTION 'Order exceeds remaining monthly subscription quota'
                USING ERRCODE = '23514';
        END IF;

        IF v_requested_item_count > v_concurrent_remaining THEN
            RAISE EXCEPTION 'Order exceeds remaining concurrent subscription capacity'
                USING ERRCODE = '23514';
        END IF;
    END IF;

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
               public.get_product_plan_value(p.id) AS mrp,
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

        IF v_product.early_access_until IS NOT NULL
           AND v_product.early_access_until > NOW()
           AND NOT v_has_early_access THEN
            RAISE EXCEPTION 'This product is currently in early access'
                USING ERRCODE = '23514';
        END IF;

        IF v_has_subscription
           AND COALESCE(v_product.mrp, 0) > v_max_item_value THEN
            RAISE EXCEPTION 'One or more items exceed your plan coverage limit'
                USING ERRCODE = '23514';
        END IF;

        v_effective_rental_price := public.calculate_effective_rental_price(v_product_id);
        v_item_deposit := CASE
            WHEN v_has_subscription THEN 0
            ELSE COALESCE(v_product.deposit_amount, ROUND(v_effective_rental_price * 0.3))
        END;

        IF NOT v_has_subscription THEN
            v_subtotal := v_subtotal + (v_effective_rental_price * v_qty);
        END IF;
        v_total_deposit := v_total_deposit + (v_item_deposit * v_qty);
    END LOOP;

    IF p_delivery_distance_km IS NOT NULL AND p_delivery_distance_km > 6 THEN
        v_distance_surcharge := ROUND(p_delivery_distance_km - 6) * 10;
    END IF;

    IF p_order_type = 'home_try_on' THEN
        v_delivery_fee := 0;
    ELSE
        v_delivery_fee := CASE
            WHEN v_free_delivery THEN 0
            ELSE 40 + v_distance_surcharge
        END;
    END IF;

    v_insurance_fee := CASE
        WHEN v_insurance_included THEN 0
        WHEN COALESCE(p_pop_insurance, TRUE) THEN 200
        ELSE 0
    END;

    v_total := v_subtotal + v_delivery_fee + v_insurance_fee;
    v_support_tier := CASE WHEN v_has_premium_support THEN 'premium' ELSE 'standard' END;
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
        v_subscription_id,
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
        v_effective_rental_price := public.calculate_effective_rental_price(v_product_id);

        SELECT CASE
            WHEN v_has_subscription THEN 0
            ELSE COALESCE(p.deposit_amount, ROUND(v_effective_rental_price * 0.3))
        END
        INTO v_item_deposit
        FROM public.products p
        WHERE p.id = v_product_id;

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
                CASE WHEN v_has_subscription THEN 0 ELSE v_effective_rental_price END,
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
        'subscriptionId', v_subscription_id,
        'supportTier', v_support_tier,
        'orderType', p_order_type
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_entitled_order(UUID, JSONB, TEXT, TEXT, JSONB, NUMERIC, BOOLEAN, INTEGER, TIMESTAMPTZ) TO authenticated;

-- 7) Inherit premium support priority automatically on chat inserts
CREATE OR REPLACE FUNCTION public.apply_order_support_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_support_tier TEXT;
BEGIN
    SELECT support_tier
    INTO v_support_tier
    FROM public.orders
    WHERE id = NEW.order_id;

    NEW.priority := CASE
        WHEN v_support_tier = 'premium' THEN 'premium'
        ELSE 'standard'
    END;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.order_support_chats') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS trg_apply_order_support_priority ON public.order_support_chats;
        CREATE TRIGGER trg_apply_order_support_priority
        BEFORE INSERT ON public.order_support_chats
        FOR EACH ROW
        EXECUTE FUNCTION public.apply_order_support_priority();
    END IF;
END $$;

-- 8) Tighten direct customer writes to orders and order_items
DO $$
DECLARE
    v_policy RECORD;
BEGIN
    FOR v_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'orders'
          AND cmd = 'INSERT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', v_policy.policyname);
    END LOOP;

    FOR v_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'order_items'
          AND cmd = 'INSERT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', v_policy.policyname);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
