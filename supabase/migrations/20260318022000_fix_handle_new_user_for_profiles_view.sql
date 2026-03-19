-- =====================================================
-- Fix auth signup trigger when public.profiles is a view
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_full_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
    v_phone TEXT := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
    v_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
    v_customer_has_id BOOLEAN := FALSE;
    v_customer_has_phone BOOLEAN := FALSE;
    v_effective_phone TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer_profiles'
          AND column_name = 'id'
    ) INTO v_customer_has_id;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer_profiles'
          AND column_name = 'phone'
    ) INTO v_customer_has_phone;

    v_effective_phone := COALESCE(v_phone, 'pending-' || LEFT(NEW.id::TEXT, 12));

    -- Preferred path for the current schema split.
    IF to_regclass('public.customer_profiles') IS NOT NULL THEN
        EXECUTE format(
            'INSERT INTO public.customer_profiles (%suser_id, full_name%s)
             VALUES (%s$1, $2%s)
             ON CONFLICT (user_id) DO UPDATE SET
                 full_name = EXCLUDED.full_name%s',
            CASE WHEN v_customer_has_id THEN 'id, ' ELSE '' END,
            CASE WHEN v_customer_has_phone THEN ', phone' ELSE '' END,
            CASE WHEN v_customer_has_id THEN '$1, ' ELSE '' END,
            CASE WHEN v_customer_has_phone THEN ', $3' ELSE '' END,
            CASE WHEN v_customer_has_phone THEN ', phone = EXCLUDED.phone' ELSE '' END
        )
        USING NEW.id, v_full_name, v_effective_phone;

    -- Legacy fallback only when profiles is an actual base table.
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND table_type = 'BASE TABLE'
    ) THEN
        INSERT INTO public.profiles (user_id, full_name, phone, role)
        VALUES (NEW.id, v_full_name, v_effective_phone, v_role)
        ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            role = EXCLUDED.role;
    END IF;

    -- Rider extras remain optional and only run when those tables exist.
    IF v_role = 'rider' AND to_regclass('public.riders') IS NOT NULL THEN
        INSERT INTO public.riders (id, user_id, name, phone, email, vehicle_type, vehicle_number, license_number)
        VALUES (
            NEW.id,
            NEW.id,
            v_full_name,
            v_effective_phone,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'vehicle_type', 'scooter'),
            COALESCE(NEW.raw_user_meta_data->>'vehicle_number', ''),
            COALESCE(NEW.raw_user_meta_data->>'license_number', '')
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF v_role = 'rider' AND to_regclass('public.rider_settings') IS NOT NULL THEN
        INSERT INTO public.rider_settings (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN others THEN
        RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
