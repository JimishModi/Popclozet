-- ============================================================
-- PII Field-Level Encryption with pgcrypto
-- ============================================================
-- This migration adds encrypted columns for sensitive PII fields
-- (phone, email) in the profiles table, using pgcrypto's
-- symmetric PGP encryption.
--
-- IMPORTANT: Set the encryption key as a Supabase secret:
--   supabase secrets set PII_ENCRYPTION_KEY=your-strong-random-key
--
-- After running this migration:
-- 1. Backfill existing data using the encrypt helpers below
-- 2. Verify decryption works before dropping plaintext columns
-- ============================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Encrypted PII columns ──────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS email_encrypted BYTEA;

-- ─── Helper functions for encrypt/decrypt ────────────────────

-- Encrypt a plaintext value using the app-level PII key
CREATE OR REPLACE FUNCTION encrypt_pii(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Read key from Supabase vault / environment
  SELECT decrypted_secret INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'PII_ENCRYPTION_KEY'
    LIMIT 1;

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'PII_ENCRYPTION_KEY not found in vault';
  END IF;

  RETURN pgp_sym_encrypt(plaintext, encryption_key);
END;
$$;

-- Decrypt a BYTEA value back to plaintext
CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  SELECT decrypted_secret INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'PII_ENCRYPTION_KEY'
    LIMIT 1;

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'PII_ENCRYPTION_KEY not found in vault';
  END IF;

  RETURN pgp_sym_decrypt(ciphertext, encryption_key);
END;
$$;

-- ─── Backfill existing plaintext data ────────────────────────
-- Run this ONCE after setting the PII_ENCRYPTION_KEY secret:
--
-- UPDATE profiles
--   SET phone_encrypted = encrypt_pii(phone),
--       email_encrypted = encrypt_pii(email)
--   WHERE phone IS NOT NULL OR email IS NOT NULL;
--
-- After verifying, you can drop the plaintext columns:
-- ALTER TABLE profiles DROP COLUMN phone, DROP COLUMN email;

-- ─── RLS: only the user themselves can read their decrypted PII
CREATE POLICY "Users can read own decrypted PII"
  ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON FUNCTION encrypt_pii IS 'Encrypts PII text using pgcrypto symmetric PGP encryption with the PII_ENCRYPTION_KEY from Supabase vault.';
COMMENT ON FUNCTION decrypt_pii IS 'Decrypts PII bytea using pgcrypto symmetric PGP decryption with the PII_ENCRYPTION_KEY from Supabase vault.';
