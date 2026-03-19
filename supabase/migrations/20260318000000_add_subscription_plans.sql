-- 1) Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    tagline TEXT,
    monthly_items INTEGER NOT NULL,
    max_item_value NUMERIC NOT NULL,
    free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
    insurance_included BOOLEAN NOT NULL DEFAULT FALSE,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Normalize legacy deployments where subscription_plans.id was numeric
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

-- 3) Ensure required columns exist for older deployments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'name'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'price'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN price NUMERIC;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'tagline'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN tagline TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'monthly_items'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN monthly_items INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'max_item_value'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN max_item_value NUMERIC;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'free_delivery'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN free_delivery BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'insurance_included'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN insurance_included BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'features'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN features JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscription_plans'
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.subscription_plans ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    UPDATE public.subscription_plans
    SET
        name = COALESCE(name, 'Legacy Plan'),
        price = COALESCE(price, 0),
        monthly_items = COALESCE(monthly_items, 0),
        max_item_value = COALESCE(max_item_value, 0);

    ALTER TABLE public.subscription_plans ALTER COLUMN name SET NOT NULL;
    ALTER TABLE public.subscription_plans ALTER COLUMN price SET NOT NULL;
    ALTER TABLE public.subscription_plans ALTER COLUMN monthly_items SET NOT NULL;
    ALTER TABLE public.subscription_plans ALTER COLUMN max_item_value SET NOT NULL;
END $$;

-- 4) Keep updated_at current on row updates
CREATE OR REPLACE FUNCTION public.update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at_trigger ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at_trigger
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_subscription_plans_updated_at();

-- 5) Re-enable RLS and recreate policy
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active plans" 
    ON public.subscription_plans 
    FOR SELECT 
    USING (is_active = true);

-- 6) Remap any legacy subscription references by plan name before reseeding
DO $$
DECLARE
    v_has_name_column BOOLEAN := FALSE;
BEGIN
    IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'subscription_plans'
              AND column_name = 'name'
        )
        INTO v_has_name_column;

        IF v_has_name_column THEN
            UPDATE public.user_subscriptions us
            SET plan_id = CASE
                WHEN LOWER(COALESCE(sp.name, '')) IN ('basic', 'essential') THEN 'essential'
                WHEN LOWER(COALESCE(sp.name, '')) = 'standard' THEN 'standard'
                WHEN LOWER(COALESCE(sp.name, '')) = 'pro' THEN 'pro'
                ELSE us.plan_id
            END
            FROM public.subscription_plans sp
            WHERE us.plan_id = sp.id
              AND us.plan_id NOT IN ('essential', 'standard', 'pro');
        END IF;
    END IF;
END $$;

-- 7) Insert/Update data
INSERT INTO public.subscription_plans (id, name, price, tagline, monthly_items, max_item_value, free_delivery, insurance_included, features, is_active) VALUES
('essential', 'Basic', 4250, 'Start your fashion journey', 2, 15000, false, true, '[{"id":"hygiene","name":"Standard Hygiene Certification","included":true},{"id":"insurance_15k","name":"Insurance up to ₹15K","included":true},{"id":"rentals_2","name":"2 Rentals / Month","included":true},{"id":"rentals_4","name":"4 Rentals / Month","included":false},{"id":"free_delivery","name":"Free Delivery","included":false},{"id":"advance_booking","name":"Advance Booking (7 days)","included":false},{"id":"insurance_60k","name":"Insurance up to ₹60K","included":false},{"id":"rentals_6","name":"6 Rentals / Month","included":false},{"id":"early_access","name":"Early Access to New Collections","included":false},{"id":"free_home_try_on","name":"Free Home Try-On","included":false},{"id":"premium_support","name":"Premium Customer Support","included":false}]'::jsonb, true),
('standard', 'Standard', 4250, 'The perfect balance', 4, 15000, true, true, '[{"id":"hygiene","name":"Standard Hygiene Certification","included":true},{"id":"insurance_15k","name":"Insurance up to ₹15K","included":true},{"id":"rentals_2","name":"2 Rentals / Month","included":false},{"id":"rentals_4","name":"4 Rentals / Month","included":true},{"id":"free_delivery","name":"Free Delivery","included":true},{"id":"advance_booking","name":"Advance Booking (7 days)","included":true},{"id":"insurance_60k","name":"Insurance up to ₹60K","included":false},{"id":"rentals_6","name":"6 Rentals / Month","included":false},{"id":"early_access","name":"Early Access to New Collections","included":false},{"id":"free_home_try_on","name":"Free Home Try-On","included":false},{"id":"premium_support","name":"Premium Customer Support","included":false}]'::jsonb, true),
('pro', 'Pro', 4250, 'Ultimate fashion access', 6, 60000, true, true, '[{"id":"hygiene","name":"Standard Hygiene Certification","included":true},{"id":"insurance_15k","name":"Insurance up to ₹15K","included":false},{"id":"rentals_2","name":"2 Rentals / Month","included":false},{"id":"rentals_4","name":"4 Rentals / Month","included":false},{"id":"free_delivery","name":"Free Delivery","included":true},{"id":"advance_booking","name":"Advance Booking (7 days)","included":true},{"id":"insurance_60k","name":"Insurance up to ₹60K","included":true},{"id":"rentals_6","name":"6 Rentals / Month","included":true},{"id":"early_access","name":"Early Access to New Collections","included":true},{"id":"free_home_try_on","name":"Free Home Try-On","included":true},{"id":"premium_support","name":"Premium Customer Support","included":true}]'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    tagline = EXCLUDED.tagline,
    monthly_items = EXCLUDED.monthly_items,
    max_item_value = EXCLUDED.max_item_value,
    free_delivery = EXCLUDED.free_delivery,
    insurance_included = EXCLUDED.insurance_included,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active;

UPDATE public.subscription_plans
SET is_active = FALSE
WHERE id NOT IN ('essential', 'standard', 'pro');

-- 8) Enforce that subscriptions can only use valid active plans
CREATE OR REPLACE FUNCTION public.validate_active_subscription_plan()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.subscription_plans sp
        WHERE sp.id = NEW.plan_id
          AND sp.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive subscription plan: %', NEW.plan_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.user_subscriptions'::regclass
              AND conname = 'user_subscriptions_plan_id_fkey'
        ) THEN
            ALTER TABLE public.user_subscriptions
            ADD CONSTRAINT user_subscriptions_plan_id_fkey
                FOREIGN KEY (plan_id)
                REFERENCES public.subscription_plans(id)
                ON UPDATE CASCADE
                ON DELETE RESTRICT
                NOT VALID;
        END IF;

        DROP TRIGGER IF EXISTS validate_active_subscription_plan_trigger ON public.user_subscriptions;
        CREATE TRIGGER validate_active_subscription_plan_trigger
        BEFORE INSERT OR UPDATE OF plan_id ON public.user_subscriptions
        FOR EACH ROW
        EXECUTE FUNCTION public.validate_active_subscription_plan();
    END IF;
END $$;
