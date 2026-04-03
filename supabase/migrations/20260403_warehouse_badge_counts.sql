-- Warehouse badge counts and realtime support for navbar notifications.
-- Covers Orders, Returns, and Wash tabs in the warehouse app.

-- 1) Ensure all badge source tables are published to Supabase Realtime.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'return_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.return_requests;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'all_products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.all_products;
    END IF;
END $$;

-- 2) Add focused indexes for badge queries.
CREATE INDEX IF NOT EXISTS idx_orders_warehouse_badge_status
    ON public.orders (status)
    WHERE status IN ('confirmed', 'packed', 'ready_for_pickup');

CREATE INDEX IF NOT EXISTS idx_return_requests_warehouse_badge_pending
    ON public.return_requests (reason, status)
    WHERE status = 'requested' AND reason = 'immediate';

CREATE INDEX IF NOT EXISTS idx_all_products_warehouse_badge_washing
    ON public.all_products (status)
    WHERE status = 'washing';

-- 3) Aggregate badge counts behind a single RPC so the frontend can refresh
-- all badges in one round-trip and avoid per-table drift.
CREATE OR REPLACE FUNCTION public.get_warehouse_badge_counts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role
    INTO v_role
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_role NOT IN ('warehouse', 'admin') THEN
        RAISE EXCEPTION 'Only warehouse staff can read warehouse badge counts'
            USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'orders', (
            SELECT COUNT(*)
            FROM public.orders
            WHERE status IN ('confirmed', 'packed', 'ready_for_pickup')
        ),
        'returns', (
            SELECT COUNT(*)
            FROM public.return_requests
            WHERE status = 'requested'
              AND reason = 'immediate'
        ),
        'wash', (
            SELECT COUNT(*)
            FROM public.all_products
            WHERE status = 'washing'
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_badge_counts() TO authenticated;

NOTIFY pgrst, 'reload schema';
