-- =====================================================
-- CREATE ORDER SUPPORT CHATS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.order_support_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    message TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'support')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by order_id
CREATE INDEX IF NOT EXISTS idx_order_chats_order_id ON public.order_support_chats(order_id);

-- Enable RLS
ALTER TABLE public.order_support_chats ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own order chats"
    ON public.order_support_chats
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own order chats"
    ON public.order_support_chats
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Reload schema
NOTIFY pgrst, 'reload schema';
