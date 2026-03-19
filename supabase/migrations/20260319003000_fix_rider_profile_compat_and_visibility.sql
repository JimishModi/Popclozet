-- =====================================================
-- Fix rider profile compatibility and rider order visibility
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

DO $$
DECLARE
    v_customer_select TEXT;
    v_rider_select TEXT;
    v_warehouse_select TEXT;
    v_column_projection TEXT;
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RETURN;
    END IF;

    v_customer_select := CASE
        WHEN to_regclass('public.customer_profiles') IS NOT NULL THEN
            'SELECT
                COALESCE((to_jsonb(cp)->>''user_id'')::UUID, (to_jsonb(cp)->>''id'')::UUID) AS user_id,
                COALESCE(to_jsonb(cp)->>''full_name'', '''') AS full_name,
                ''customer''::TEXT AS role,
                COALESCE((to_jsonb(cp)->>''id'')::UUID, (to_jsonb(cp)->>''user_id'')::UUID) AS id,
                COALESCE(to_jsonb(cp)->>''phone'', '''') AS phone,
                NULLIF(to_jsonb(cp)->>''avatar_url'', '''') AS avatar_url,
                COALESCE((to_jsonb(cp)->>''onboarding_completed'')::BOOLEAN, FALSE) AS onboarding_completed,
                COALESCE((to_jsonb(cp)->>''created_at'')::TIMESTAMPTZ, NOW()) AS created_at,
                COALESCE((to_jsonb(cp)->>''updated_at'')::TIMESTAMPTZ, NOW()) AS updated_at,
                NULLIF(to_jsonb(cp)->>''email'', '''') AS email,
                NULLIF(to_jsonb(cp)->>''gender'', '''') AS gender,
                COALESCE(to_jsonb(cp)->''measurements'', ''{}''::JSONB) AS measurements,
                COALESCE((to_jsonb(cp)->>''is_suspended'')::BOOLEAN, FALSE) AS is_suspended,
                (to_jsonb(cp)->>''suspended_at'')::TIMESTAMPTZ AS suspended_at,
                NULLIF(to_jsonb(cp)->>''suspension_reason'', '''') AS suspension_reason
             FROM public.customer_profiles cp'
        ELSE
            'SELECT
                NULL::UUID AS user_id,
                NULL::TEXT AS full_name,
                ''customer''::TEXT AS role,
                NULL::UUID AS id,
                NULL::TEXT AS phone,
                NULL::TEXT AS avatar_url,
                FALSE AS onboarding_completed,
                NOW() AS created_at,
                NOW() AS updated_at,
                NULL::TEXT AS email,
                NULL::TEXT AS gender,
                ''{}''::JSONB AS measurements,
                FALSE AS is_suspended,
                NULL::TIMESTAMPTZ AS suspended_at,
                NULL::TEXT AS suspension_reason
             WHERE FALSE'
    END;

    v_rider_select := CASE
        WHEN to_regclass('public.rider_profiles') IS NOT NULL THEN
            'SELECT
                COALESCE((to_jsonb(rp)->>''user_id'')::UUID, (to_jsonb(rp)->>''id'')::UUID) AS user_id,
                COALESCE(to_jsonb(rp)->>''full_name'', to_jsonb(rp)->>''name'', '''') AS full_name,
                ''rider''::TEXT AS role,
                COALESCE((to_jsonb(rp)->>''id'')::UUID, (to_jsonb(rp)->>''user_id'')::UUID) AS id,
                COALESCE(to_jsonb(rp)->>''phone'', '''') AS phone,
                NULLIF(to_jsonb(rp)->>''avatar_url'', '''') AS avatar_url,
                TRUE AS onboarding_completed,
                COALESCE((to_jsonb(rp)->>''created_at'')::TIMESTAMPTZ, NOW()) AS created_at,
                COALESCE((to_jsonb(rp)->>''updated_at'')::TIMESTAMPTZ, NOW()) AS updated_at,
                NULLIF(to_jsonb(rp)->>''email'', '''') AS email,
                NULLIF(to_jsonb(rp)->>''gender'', '''') AS gender,
                ''{}''::JSONB AS measurements,
                FALSE AS is_suspended,
                NULL::TIMESTAMPTZ AS suspended_at,
                NULL::TEXT AS suspension_reason
             FROM public.rider_profiles rp'
        WHEN to_regclass('public.riders') IS NOT NULL THEN
            'SELECT
                COALESCE((to_jsonb(r)->>''user_id'')::UUID, (to_jsonb(r)->>''id'')::UUID) AS user_id,
                COALESCE(to_jsonb(r)->>''name'', to_jsonb(r)->>''full_name'', '''') AS full_name,
                ''rider''::TEXT AS role,
                COALESCE((to_jsonb(r)->>''id'')::UUID, (to_jsonb(r)->>''user_id'')::UUID) AS id,
                COALESCE(to_jsonb(r)->>''phone'', '''') AS phone,
                NULLIF(to_jsonb(r)->>''avatar_url'', '''') AS avatar_url,
                TRUE AS onboarding_completed,
                COALESCE((to_jsonb(r)->>''joined_at'')::TIMESTAMPTZ, NOW()) AS created_at,
                COALESCE((to_jsonb(r)->>''updated_at'')::TIMESTAMPTZ, (to_jsonb(r)->>''joined_at'')::TIMESTAMPTZ, NOW()) AS updated_at,
                NULLIF(to_jsonb(r)->>''email'', '''') AS email,
                NULL::TEXT AS gender,
                ''{}''::JSONB AS measurements,
                FALSE AS is_suspended,
                NULL::TIMESTAMPTZ AS suspended_at,
                NULL::TEXT AS suspension_reason
             FROM public.riders r'
        ELSE
            'SELECT
                NULL::UUID AS user_id,
                NULL::TEXT AS full_name,
                ''rider''::TEXT AS role,
                NULL::UUID AS id,
                NULL::TEXT AS phone,
                NULL::TEXT AS avatar_url,
                TRUE AS onboarding_completed,
                NOW() AS created_at,
                NOW() AS updated_at,
                NULL::TEXT AS email,
                NULL::TEXT AS gender,
                ''{}''::JSONB AS measurements,
                FALSE AS is_suspended,
                NULL::TIMESTAMPTZ AS suspended_at,
                NULL::TEXT AS suspension_reason
             WHERE FALSE'
    END;

    v_warehouse_select := CASE
        WHEN to_regclass('public.warehouse_profiles') IS NOT NULL THEN
            'SELECT
                COALESCE((to_jsonb(wp)->>''user_id'')::UUID, (to_jsonb(wp)->>''id'')::UUID) AS user_id,
                COALESCE(to_jsonb(wp)->>''full_name'', '''') AS full_name,
                ''warehouse''::TEXT AS role,
                COALESCE((to_jsonb(wp)->>''id'')::UUID, (to_jsonb(wp)->>''user_id'')::UUID) AS id,
                COALESCE(to_jsonb(wp)->>''phone'', '''') AS phone,
                NULLIF(to_jsonb(wp)->>''avatar_url'', '''') AS avatar_url,
                TRUE AS onboarding_completed,
                COALESCE((to_jsonb(wp)->>''created_at'')::TIMESTAMPTZ, NOW()) AS created_at,
                COALESCE((to_jsonb(wp)->>''updated_at'')::TIMESTAMPTZ, NOW()) AS updated_at,
                NULLIF(to_jsonb(wp)->>''email'', '''') AS email,
                NULL::TEXT AS gender,
                ''{}''::JSONB AS measurements,
                FALSE AS is_suspended,
                NULL::TIMESTAMPTZ AS suspended_at,
                NULL::TEXT AS suspension_reason
             FROM public.warehouse_profiles wp'
        ELSE
            'SELECT
                NULL::UUID AS user_id,
                NULL::TEXT AS full_name,
                ''warehouse''::TEXT AS role,
                NULL::UUID AS id,
                NULL::TEXT AS phone,
                NULL::TEXT AS avatar_url,
                TRUE AS onboarding_completed,
                NOW() AS created_at,
                NOW() AS updated_at,
                NULL::TEXT AS email,
                NULL::TEXT AS gender,
                ''{}''::JSONB AS measurements,
                FALSE AS is_suspended,
                NULL::TIMESTAMPTZ AS suspended_at,
                NULL::TEXT AS suspension_reason
             WHERE FALSE'
    END;

    SELECT string_agg(
        CASE c.column_name
            WHEN 'user_id' THEN 'src.user_id'
            WHEN 'full_name' THEN 'src.full_name'
            WHEN 'role' THEN 'src.role'
            WHEN 'id' THEN 'src.id'
            WHEN 'phone' THEN 'src.phone'
            WHEN 'avatar_url' THEN 'src.avatar_url'
            WHEN 'onboarding_completed' THEN 'src.onboarding_completed'
            WHEN 'created_at' THEN 'src.created_at'
            WHEN 'updated_at' THEN 'src.updated_at'
            WHEN 'email' THEN 'src.email'
            WHEN 'gender' THEN 'src.gender'
            WHEN 'measurements' THEN 'src.measurements'
            WHEN 'is_suspended' THEN 'src.is_suspended'
            WHEN 'suspended_at' THEN 'src.suspended_at'
            WHEN 'suspension_reason' THEN 'src.suspension_reason'
            ELSE format('NULL::%s AS %I', c.pg_type, c.column_name)
        END,
        ', '
        ORDER BY c.ordinal_position
    )
    INTO v_column_projection
    FROM (
        SELECT
            a.attname AS column_name,
            a.attnum AS ordinal_position,
            pg_catalog.format_type(a.atttypid, a.atttypmod) AS pg_type
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class cl
            ON cl.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n
            ON n.oid = cl.relnamespace
        WHERE n.nspname = 'public'
          AND cl.relname = 'profiles'
          AND a.attnum > 0
          AND NOT a.attisdropped
    ) c;

    EXECUTE 'CREATE OR REPLACE VIEW public.profiles AS
        SELECT ' || v_column_projection || '
        FROM (
            ' || v_customer_select || '
            UNION ALL
            ' || v_rider_select || '
            UNION ALL
            ' || v_warehouse_select || '
        ) src';
END $$;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

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

NOTIFY pgrst, 'reload schema';
