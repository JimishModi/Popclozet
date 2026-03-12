-- =====================================================
-- ALTER PAYMENTS SCHEMA FOR RIDER EARNINGS
-- =====================================================

-- The payments table was originally created for Customer checkouts.
-- The Rider App utilizes the same table to track payouts by filtering
-- via `rider_id` and `type` (earning/bonus), but these columns 
-- were never added to the schema. 

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'payment';

-- Force PostgREST schema cache reload so the Rider app recognizes it immediately
NOTIFY pgrst, 'reload schema';
