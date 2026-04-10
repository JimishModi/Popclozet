-- Migration: Store payment QR code in DB so rider app fetches it server-side
-- This prevents client-side tampering — only admins can change the QR via DB/dashboard.

-- 1. Create app_settings table (key-value config store)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anyone can read settings (no auth required for public config)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
CREATE POLICY "Admins can manage app_settings"
  ON public.app_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 2. Create storage bucket for app assets (QR codes, logos, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from app-assets bucket (public)
DROP POLICY IF EXISTS "Public read app-assets" ON storage.objects;
CREATE POLICY "Public read app-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-assets');

-- Only admins can upload to app-assets
DROP POLICY IF EXISTS "Admins upload app-assets" ON storage.objects;
CREATE POLICY "Admins upload app-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'app-assets'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Insert the payment QR URL placeholder
-- After running this migration, upload the QR image to Supabase Storage:
--   Bucket: app-assets, Path: payment-qr.png
-- Then update this row with the public URL:
--   UPDATE app_settings SET value = '<public_url>' WHERE key = 'payment_qr_url';
INSERT INTO public.app_settings (key, value)
VALUES ('payment_qr_url', '')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
