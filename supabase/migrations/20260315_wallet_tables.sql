-- =====================================================
-- WALLET & PAYMENTS SYSTEM
-- =====================================================

-- 1. Create tables

CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE UNIQUE,
    balance NUMERIC(10, 2) DEFAULT 0,
    pending_withdrawals NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'earning' CHECK (type IN ('earning', 'bonus', 'withdrawal', 'refund')),
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    bank_details JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Riders can view their own wallet" ON public.wallets FOR SELECT USING (rider_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Riders can view their own payments" ON public.payments FOR SELECT USING (rider_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "Riders can insert their own payments" ON public.payments FOR INSERT WITH CHECK (rider_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Riders can view their own withdrawals" ON public.withdrawal_requests FOR SELECT USING (rider_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "Riders can insert their own withdrawals" ON public.withdrawal_requests FOR INSERT WITH CHECK (rider_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create trigger to auto-create wallet on rider creation
CREATE OR REPLACE FUNCTION public.handle_new_rider_wallet()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'rider' THEN
        INSERT INTO public.wallets (rider_id) VALUES (NEW.user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_new_rider_wallet ON public.profiles;
CREATE TRIGGER tr_handle_new_rider_wallet
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_rider_wallet();

-- Insert wallets for existing riders
INSERT INTO public.wallets (rider_id)
SELECT user_id FROM public.profiles WHERE role = 'rider'
ON CONFLICT DO NOTHING;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
