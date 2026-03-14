-- Create legal_acceptances table
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    tc_version TEXT NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own legal acceptances"
    ON public.legal_acceptances
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own legal acceptances"
    ON public.legal_acceptances
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all legal acceptances"
    ON public.legal_acceptances
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin', 'warehouse')
        )
    );

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_id ON public.legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_order_id ON public.legal_acceptances(order_id);
