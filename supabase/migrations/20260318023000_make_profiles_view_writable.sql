-- =====================================================
-- Make public.profiles compatibility view writable
-- =====================================================

DO $$
DECLARE
    v_customer_has_id BOOLEAN;
    v_customer_has_phone BOOLEAN;
    v_customer_has_avatar_url BOOLEAN;
    v_customer_has_onboarding_completed BOOLEAN;
    v_customer_has_created_at BOOLEAN;
    v_customer_has_updated_at BOOLEAN;
    v_rider_has_id BOOLEAN;
    v_rider_has_user_id BOOLEAN;
    v_rider_has_phone BOOLEAN;
    v_rider_has_avatar_url BOOLEAN;
    v_rider_has_created_at BOOLEAN;
    v_rider_has_updated_at BOOLEAN;
    v_warehouse_has_id BOOLEAN;
    v_warehouse_has_phone BOOLEAN;
    v_warehouse_has_avatar_url BOOLEAN;
    v_warehouse_has_created_at BOOLEAN;
    v_warehouse_has_updated_at BOOLEAN;
    v_sql TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'id'
    ) INTO v_customer_has_id;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'phone'
    ) INTO v_customer_has_phone;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'avatar_url'
    ) INTO v_customer_has_avatar_url;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'onboarding_completed'
    ) INTO v_customer_has_onboarding_completed;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'created_at'
    ) INTO v_customer_has_created_at;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'updated_at'
    ) INTO v_customer_has_updated_at;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'rider_profiles' AND column_name = 'id'
    ) INTO v_rider_has_id;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'rider_profiles' AND column_name = 'user_id'
    ) INTO v_rider_has_user_id;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'rider_profiles' AND column_name = 'phone'
    ) INTO v_rider_has_phone;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'rider_profiles' AND column_name = 'avatar_url'
    ) INTO v_rider_has_avatar_url;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'rider_profiles' AND column_name = 'created_at'
    ) INTO v_rider_has_created_at;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'rider_profiles' AND column_name = 'updated_at'
    ) INTO v_rider_has_updated_at;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'warehouse_profiles' AND column_name = 'id'
    ) INTO v_warehouse_has_id;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'warehouse_profiles' AND column_name = 'phone'
    ) INTO v_warehouse_has_phone;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'warehouse_profiles' AND column_name = 'avatar_url'
    ) INTO v_warehouse_has_avatar_url;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'warehouse_profiles' AND column_name = 'created_at'
    ) INTO v_warehouse_has_created_at;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'warehouse_profiles' AND column_name = 'updated_at'
    ) INTO v_warehouse_has_updated_at;

    v_sql := format($view$
        CREATE OR REPLACE VIEW public.profiles AS
        SELECT
            cp.user_id,
            cp.full_name,
            'customer'::TEXT AS role,
            %17$s AS id,
            %1$s AS phone,
            %2$s AS avatar_url,
            %3$s AS onboarding_completed,
            %4$s AS created_at,
            %5$s AS updated_at
        FROM public.customer_profiles cp
        UNION ALL
        SELECT
            %7$s AS user_id,
            rp.full_name,
            'rider'::TEXT AS role,
            %6$s AS id,
            %8$s AS phone,
            %9$s AS avatar_url,
            FALSE AS onboarding_completed,
            %10$s AS created_at,
            %11$s AS updated_at
        FROM public.rider_profiles rp
        UNION ALL
        SELECT
            wp.user_id AS user_id,
            wp.full_name,
            'warehouse'::TEXT AS role,
            %12$s AS id,
            %13$s AS phone,
            %14$s AS avatar_url,
            FALSE AS onboarding_completed,
            %15$s AS created_at,
            %16$s AS updated_at
        FROM public.warehouse_profiles wp
    $view$,
        CASE WHEN v_customer_has_phone THEN 'cp.phone' ELSE '''''' END,
        CASE WHEN v_customer_has_avatar_url THEN 'cp.avatar_url' ELSE 'NULL::TEXT' END,
        CASE WHEN v_customer_has_onboarding_completed THEN 'COALESCE(cp.onboarding_completed, FALSE)' ELSE 'FALSE' END,
        CASE WHEN v_customer_has_created_at THEN 'cp.created_at' ELSE 'NOW()' END,
        CASE WHEN v_customer_has_updated_at THEN 'cp.updated_at' ELSE 'NOW()' END,
        CASE WHEN v_rider_has_id THEN 'rp.id' ELSE COALESCE(CASE WHEN v_rider_has_user_id THEN 'rp.user_id' ELSE 'NULL::UUID' END, 'NULL::UUID') END,
        CASE WHEN v_rider_has_user_id THEN 'rp.user_id' ELSE COALESCE(CASE WHEN v_rider_has_id THEN 'rp.id' ELSE 'NULL::UUID' END, 'NULL::UUID') END,
        CASE WHEN v_rider_has_phone THEN 'rp.phone' ELSE 'NULL::TEXT' END,
        CASE WHEN v_rider_has_avatar_url THEN 'rp.avatar_url' ELSE 'NULL::TEXT' END,
        CASE WHEN v_rider_has_created_at THEN 'rp.created_at' ELSE 'NOW()' END,
        CASE WHEN v_rider_has_updated_at THEN 'rp.updated_at' ELSE 'NOW()' END,
        CASE WHEN v_warehouse_has_id THEN 'wp.id' ELSE 'wp.user_id' END,
        CASE WHEN v_warehouse_has_phone THEN 'wp.phone' ELSE 'NULL::TEXT' END,
        CASE WHEN v_warehouse_has_avatar_url THEN 'wp.avatar_url' ELSE 'NULL::TEXT' END,
        CASE WHEN v_warehouse_has_created_at THEN 'wp.created_at' ELSE 'NOW()' END,
        CASE WHEN v_warehouse_has_updated_at THEN 'wp.updated_at' ELSE 'NOW()' END,
        CASE WHEN v_customer_has_id THEN 'cp.id' ELSE 'cp.user_id' END
    );

    EXECUTE v_sql;
END $$;

CREATE OR REPLACE FUNCTION public.profiles_view_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_id BOOLEAN;
    v_has_phone BOOLEAN;
    v_has_avatar_url BOOLEAN;
    v_has_onboarding_completed BOOLEAN;
    v_insert_phone TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'id'
    ) INTO v_has_id;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'phone'
    ) INTO v_has_phone;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'avatar_url'
    ) INTO v_has_avatar_url;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'onboarding_completed'
    ) INTO v_has_onboarding_completed;

    v_insert_phone := COALESCE(NULLIF(BTRIM(COALESCE(NEW.phone, '')), ''), 'pending-' || LEFT(NEW.user_id::TEXT, 12));

    IF TG_OP = 'INSERT' THEN
        IF COALESCE(NEW.role, 'customer') <> 'customer' THEN
            RAISE EXCEPTION 'Only customer profile inserts are supported through public.profiles'
                USING ERRCODE = '42501';
        END IF;

        EXECUTE format(
            'INSERT INTO public.customer_profiles (%suser_id, full_name%s%s%s) VALUES (%s$1, $2%s%s%s)
             ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name%s%s%s',
            CASE WHEN v_has_id THEN 'id, ' ELSE '' END,
            CASE WHEN v_has_phone THEN ', phone' ELSE '' END,
            CASE WHEN v_has_avatar_url THEN ', avatar_url' ELSE '' END,
            CASE WHEN v_has_onboarding_completed THEN ', onboarding_completed' ELSE '' END,
            CASE WHEN v_has_id THEN '$1, ' ELSE '' END,
            CASE WHEN v_has_phone THEN ', $3' ELSE '' END,
            CASE WHEN v_has_avatar_url THEN ', $4' ELSE '' END,
            CASE WHEN v_has_onboarding_completed THEN ', $5' ELSE '' END,
            CASE WHEN v_has_phone THEN ', phone = EXCLUDED.phone' ELSE '' END,
            CASE WHEN v_has_avatar_url THEN ', avatar_url = EXCLUDED.avatar_url' ELSE '' END,
            CASE WHEN v_has_onboarding_completed THEN ', onboarding_completed = EXCLUDED.onboarding_completed' ELSE '' END
        )
        USING
            NEW.user_id,
            COALESCE(NEW.full_name, ''),
            v_insert_phone,
            NEW.avatar_url,
            COALESCE(NEW.onboarding_completed, FALSE);

        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.role <> 'customer' THEN
            RAISE EXCEPTION 'Only customer profile updates are supported through public.profiles'
                USING ERRCODE = '42501';
        END IF;

        EXECUTE format(
            'UPDATE public.customer_profiles
             SET full_name = COALESCE($1, full_name)%s%s%s
             WHERE user_id = $2',
            CASE WHEN v_has_phone THEN ', phone = COALESCE($3, phone)' ELSE '' END,
            CASE WHEN v_has_avatar_url THEN ', avatar_url = COALESCE($4, avatar_url)' ELSE '' END,
            CASE WHEN v_has_onboarding_completed THEN ', onboarding_completed = COALESCE($5, onboarding_completed)' ELSE '' END
        )
        USING
            NEW.full_name,
            OLD.user_id,
            NEW.phone,
            NEW.avatar_url,
            NEW.onboarding_completed;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.role = 'customer' THEN
            DELETE FROM public.customer_profiles
            WHERE user_id = OLD.user_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_view_write ON public.profiles;
CREATE TRIGGER trg_profiles_view_write
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_view_write();

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

NOTIFY pgrst, 'reload schema';
