CREATE TABLE IF NOT EXISTS public.manual_kyc_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending_review',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.manual_kyc_reviews ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read manual_kyc_reviews"
  ON public.manual_kyc_reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert/update (called from webhook)
CREATE POLICY "Allow service role full access to manual_kyc_reviews"
  ON public.manual_kyc_reviews
  FOR ALL
  TO service_role
  USING (true);

-- Enable Realtime for manual_kyc_reviews
ALTER PUBLICATION supabase_realtime ADD TABLE manual_kyc_reviews;
