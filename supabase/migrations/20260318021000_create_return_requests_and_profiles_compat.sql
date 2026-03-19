-- =====================================================
-- Create Return Requests Table And Profiles Compatibility View
-- =====================================================

CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT 'scheduled_return',
    pickup_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
    pickup_slot TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'requested',
    rider_id UUID,
    pickup_eta TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.return_requests'::regclass
          AND conname = 'return_requests_order_id_key'
    ) THEN
        ALTER TABLE public.return_requests
        ADD CONSTRAINT return_requests_order_id_key UNIQUE (order_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.return_requests'::regclass
          AND conname = 'return_requests_status_check'
    ) THEN
        ALTER TABLE public.return_requests
        ADD CONSTRAINT return_requests_status_check
        CHECK (status IN ('requested', 'approved', 'assigned', 'picked_up', 'completed', 'cancelled'))
        NOT VALID;
    END IF;
END $$;

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        EXECUTE $view$
            CREATE VIEW public.profiles AS
            SELECT
                cp.user_id,
                cp.full_name,
                'customer'::TEXT AS role
            FROM public.customer_profiles cp
            UNION ALL
            SELECT
                rp.user_id,
                rp.full_name,
                'rider'::TEXT AS role
            FROM public.rider_profiles rp
            UNION ALL
            SELECT
                wp.user_id,
                wp.full_name,
                'warehouse'::TEXT AS role
            FROM public.warehouse_profiles wp
        $view$;
    END IF;
END $$;

DROP POLICY IF EXISTS "Users manage own return requests" ON public.return_requests;
CREATE POLICY "Users manage own return requests"
    ON public.return_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = return_requests.order_id
              AND o.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = return_requests.order_id
              AND o.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Warehouse and admin manage return requests" ON public.return_requests;
CREATE POLICY "Warehouse and admin manage return requests"
    ON public.return_requests
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT user_id
            FROM public.profiles
            WHERE role IN ('warehouse', 'admin')
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id
            FROM public.profiles
            WHERE role IN ('warehouse', 'admin')
        )
    );

DROP POLICY IF EXISTS "Riders view assigned return requests" ON public.return_requests;
CREATE POLICY "Riders view assigned return requests"
    ON public.return_requests
    FOR SELECT
    USING (
        rider_id = auth.uid()
        OR auth.uid() IN (
            SELECT user_id
            FROM public.profiles
            WHERE role = 'rider'
        )
    );

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

NOTIFY pgrst, 'reload schema';
