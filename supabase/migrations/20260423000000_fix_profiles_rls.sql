-- =====================================================
-- FIX: Profiles RLS — stop anon users reading all profiles
-- =====================================================
--
-- Root cause: public.profiles is a VIEW over customer_profiles /
-- rider_profiles / warehouse_profiles. Those three base tables
-- had no RLS. A previous migration granted SELECT on the view
-- to the anon role, so any visitor could read every customer's
-- phone number and personal data.
--
-- Fix:
--  1. Enable RLS on the three underlying tables.
--  2. Own-profile read/write for each role.
--  3. Warehouse staff can read all customer_profiles (needed for
--     order management — displaying customer name/phone on orders).
--  4. Revoke SELECT on public.profiles from anon.
-- =====================================================

-- ─── 1. customer_profiles ───────────────────────────────────────

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own profile" ON public.customer_profiles;
CREATE POLICY "Customers read own profile"
    ON public.customer_profiles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers update own profile" ON public.customer_profiles;
CREATE POLICY "Customers update own profile"
    ON public.customer_profiles FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers insert own profile" ON public.customer_profiles;
CREATE POLICY "Customers insert own profile"
    ON public.customer_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Warehouse staff need to read all customer profiles to show
-- customer details on orders in the warehouse dashboard.
-- Check is done directly against warehouse_profiles (no circular dep).
DROP POLICY IF EXISTS "Warehouse reads all customer profiles" ON public.customer_profiles;
CREATE POLICY "Warehouse reads all customer profiles"
    ON public.customer_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.warehouse_profiles wp
            WHERE wp.user_id = auth.uid()
        )
    );

-- ─── 2. rider_profiles ──────────────────────────────────────────

DO $$
BEGIN
    IF to_regclass('public.rider_profiles') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Riders read own profile" ON public.rider_profiles';
        EXECUTE $p$
            CREATE POLICY "Riders read own profile"
                ON public.rider_profiles FOR SELECT
                USING (auth.uid() = user_id)
        $p$;

        EXECUTE 'DROP POLICY IF EXISTS "Riders update own profile" ON public.rider_profiles';
        EXECUTE $p$
            CREATE POLICY "Riders update own profile"
                ON public.rider_profiles FOR UPDATE
                USING (auth.uid() = user_id)
        $p$;

        EXECUTE 'DROP POLICY IF EXISTS "Riders insert own profile" ON public.rider_profiles';
        EXECUTE $p$
            CREATE POLICY "Riders insert own profile"
                ON public.rider_profiles FOR INSERT
                WITH CHECK (auth.uid() = user_id)
        $p$;

        -- Warehouse staff can see all rider profiles (for rider assignment UI)
        EXECUTE 'DROP POLICY IF EXISTS "Warehouse reads rider profiles" ON public.rider_profiles';
        EXECUTE $p$
            CREATE POLICY "Warehouse reads rider profiles"
                ON public.rider_profiles FOR SELECT
                USING (
                    EXISTS (
                        SELECT 1 FROM public.warehouse_profiles wp
                        WHERE wp.user_id = auth.uid()
                    )
                )
        $p$;
    END IF;
END $$;

-- ─── 3. warehouse_profiles ──────────────────────────────────────

DO $$
BEGIN
    IF to_regclass('public.warehouse_profiles') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.warehouse_profiles ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Warehouse staff read own profile" ON public.warehouse_profiles';
        EXECUTE $p$
            CREATE POLICY "Warehouse staff read own profile"
                ON public.warehouse_profiles FOR SELECT
                USING (auth.uid() = user_id)
        $p$;

        EXECUTE 'DROP POLICY IF EXISTS "Warehouse staff update own profile" ON public.warehouse_profiles';
        EXECUTE $p$
            CREATE POLICY "Warehouse staff update own profile"
                ON public.warehouse_profiles FOR UPDATE
                USING (auth.uid() = user_id)
        $p$;

        EXECUTE 'DROP POLICY IF EXISTS "Warehouse staff insert own profile" ON public.warehouse_profiles';
        EXECUTE $p$
            CREATE POLICY "Warehouse staff insert own profile"
                ON public.warehouse_profiles FOR INSERT
                WITH CHECK (auth.uid() = user_id)
        $p$;
    END IF;
END $$;

-- ─── 4. Revoke anon read access on the profiles view ────────────

REVOKE SELECT ON public.profiles FROM anon;

-- authenticated role keeps its grant (users need to read their own
-- profile via the view). service_role bypasses RLS entirely
-- (Edge Functions use service_role).

-- ─── 5. Also fix the riders table (used in older schema) ─────────

DO $$
BEGIN
    IF to_regclass('public.riders') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = 'riders'
             AND c.relrowsecurity = TRUE
       )
    THEN
        EXECUTE 'ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Riders read own record" ON public.riders';
        EXECUTE $p$
            CREATE POLICY "Riders read own record"
                ON public.riders FOR SELECT
                USING (auth.uid() = id OR auth.uid() = user_id)
        $p$;

        EXECUTE 'DROP POLICY IF EXISTS "Warehouse reads all riders" ON public.riders';
        EXECUTE $p$
            CREATE POLICY "Warehouse reads all riders"
                ON public.riders FOR SELECT
                USING (
                    EXISTS (
                        SELECT 1 FROM public.warehouse_profiles wp
                        WHERE wp.user_id = auth.uid()
                    )
                )
        $p$;
    END IF;
END $$;

-- ─── Verify ─────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '✅ RLS enabled on customer_profiles, rider_profiles, warehouse_profiles';
    RAISE NOTICE '✅ anon SELECT revoked from public.profiles view';
    RAISE NOTICE '⚠️  Verification: logged-out sb.from(profiles).select(*) must return []';
END $$;

NOTIFY pgrst, 'reload schema';
