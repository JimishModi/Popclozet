-- ============================================================
-- Anti-Enumeration & Account Protection
-- ============================================================
-- Prevents attackers from discovering valid usernames/phones
-- and adds account security measures.
-- ============================================================

-- ─── 1. ANTI-ENUMERATION ────────────────────────────────────
-- Hide whether a phone/email exists during login/signup.
-- The frontend should always show: "If this number exists, we sent an OTP"

-- View: sanitized profile lookup (never reveals if a user exists)
CREATE OR REPLACE FUNCTION safe_profile_lookup(
  p_identifier TEXT -- phone or email
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ALWAYS return the same response regardless of whether user exists
  -- This prevents username/phone enumeration attacks
  RETURN jsonb_build_object(
    'message', 'If this account exists, you will receive a verification code.',
    'action', 'check_otp'
  );
END;
$$;


-- ─── 2. ACCOUNT LOCKOUT CLEANUP ─────────────────────────────
-- Automatically clean up old login attempts (run via pg_cron)

CREATE OR REPLACE FUNCTION cleanup_login_attempts()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM login_attempts
    WHERE created_at < now() - interval '24 hours'
    RETURNING *
  )
  SELECT count(*)::int FROM deleted;
$$;


-- ─── 3. ACCOUNT SUSPENSION ──────────────────────────────────
-- Suspend accounts that show suspicious activity

-- Add suspended flag if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE;
    ALTER TABLE profiles ADD COLUMN suspended_at TIMESTAMPTZ;
    ALTER TABLE profiles ADD COLUMN suspension_reason TEXT;
  END IF;
END $$;

-- Function: Suspend an account
CREATE OR REPLACE FUNCTION suspend_account(
  p_user_id  UUID,
  p_reason   TEXT DEFAULT 'Suspicious activity detected'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET is_suspended = TRUE,
      suspended_at = now(),
      suspension_reason = p_reason
  WHERE user_id = p_user_id;
END;
$$;

-- Function: Check if account is suspended (use in auth flow)
CREATE OR REPLACE FUNCTION is_account_suspended(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_suspended FROM profiles WHERE user_id = p_user_id),
    FALSE
  );
$$;


-- ─── 4. SECURE ORDER NUMBER GENERATION ──────────────────────
-- Use non-sequential order IDs to prevent enumeration

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT := 'PC';
  v_timestamp TEXT;
  v_random TEXT;
BEGIN
  -- Format: PC-YYMMDD-XXXX (non-sequential, hard to guess)
  v_timestamp := to_char(now(), 'YYMMDD');
  v_random := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
  RETURN v_prefix || '-' || v_timestamp || '-' || v_random;
END;
$$;


-- ─── 5. DATA RETENTION POLICY ───────────────────────────────
-- Auto-delete old sensitive data per GDPR/CCPA requirements

CREATE OR REPLACE FUNCTION enforce_data_retention()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT := 0;
  v_count INT;
BEGIN
  -- Delete old login attempts (>30 days)
  WITH d AS (
    DELETE FROM login_attempts WHERE created_at < now() - interval '30 days' RETURNING *
  ) SELECT count(*) INTO v_count FROM d;
  v_deleted := v_deleted + v_count;

  -- Delete old rate limit entries (>7 days)
  WITH d AS (
    DELETE FROM api_rate_limits WHERE created_at < now() - interval '7 days' RETURNING *
  ) SELECT count(*) INTO v_count FROM d;
  v_deleted := v_deleted + v_count;

  -- Delete expired idempotency keys
  WITH d AS (
    DELETE FROM idempotency_keys WHERE expires_at < now() RETURNING *
  ) SELECT count(*) INTO v_count FROM d;
  v_deleted := v_deleted + v_count;

  -- Delete acknowledged alerts older than 90 days
  WITH d AS (
    DELETE FROM alert_queue
    WHERE acknowledged = TRUE AND created_at < now() - interval '90 days'
    RETURNING *
  ) SELECT count(*) INTO v_count FROM d;
  v_deleted := v_deleted + v_count;

  RETURN v_deleted;
END;
$$;


-- ─── DOCUMENTATION ──────────────────────────────────────────
COMMENT ON FUNCTION safe_profile_lookup IS 'Anti-enumeration: always returns the same response regardless of account existence.';
COMMENT ON FUNCTION suspend_account IS 'Suspends a user account due to suspicious activity.';
COMMENT ON FUNCTION generate_order_number IS 'Generates non-sequential order numbers to prevent enumeration.';
COMMENT ON FUNCTION enforce_data_retention IS 'GDPR/CCPA: auto-deletes expired sensitive data (login attempts, rate limits, idempotency keys).';
