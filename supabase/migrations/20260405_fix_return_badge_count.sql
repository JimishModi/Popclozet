-- Fix: warehouse returns badge count was only counting status='requested',
-- but instant returns skip straight to 'approved'. Count all active
-- (non-terminal) return requests so the badge reflects real activity.

-- 1) Replace the narrow partial index with one covering all active statuses.
DROP INDEX IF EXISTS idx_return_requests_warehouse_badge_pending;

CREATE INDEX IF NOT EXISTS idx_return_requests_warehouse_badge_active
    ON public.return_requests (status)
    WHERE status NOT IN ('completed', 'rejected');

-- 2) Update the RPC to count all active return requests.
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
            WHERE status NOT IN ('completed', 'rejected')
        ),
        'wash', (
            SELECT COUNT(*)
            FROM public.all_products
            WHERE status = 'washing'
        )
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
