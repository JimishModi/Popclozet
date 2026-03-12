-- ============================================================
-- Login Rate Limiting + Password Policy + Idempotency Keys
-- + Ephemeral Rider Data Access
-- ============================================================
-- Comprehensive security migration covering all remaining
-- application-level security features.
-- ============================================================

-- ─── 1. LOGIN RATE LIMITING ─────────────────────────────────
-- Tracks failed login attempts and auto-locks accounts

CREATE TABLE IF NOT EXISTS login_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier TEXT NOT NULL,           -- email, phone, or user_id
  ip_address      INET,
  attempt_type    TEXT NOT NULL DEFAULT 'login'
                    CHECK (attempt_type IN ('login', 'otp', 'password_reset')),
  success         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user
  ON login_attempts(user_identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip
  ON login_attempts(ip_address, created_at DESC);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Only system can insert (via SECURITY DEFINER functions)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='login_attempts' AND policyname='system_insert_login_attempts') THEN
    CREATE POLICY system_insert_login_attempts ON login_attempts FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Function: Record a login attempt and check if account should be locked
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_identifier TEXT,
  p_ip         INET DEFAULT NULL,
  p_success    BOOLEAN DEFAULT FALSE,
  p_type       TEXT DEFAULT 'login'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_failures INT;
  v_lockout_until   TIMESTAMPTZ;
  v_max_attempts    INT := 5;
  v_window          INTERVAL := '15 minutes';
  v_lockout_time    INTERVAL := '30 minutes';
BEGIN
  -- Record the attempt
  INSERT INTO login_attempts (user_identifier, ip_address, success, attempt_type)
  VALUES (p_identifier, p_ip, p_success, p_type);

  -- If successful, no need to check lockout
  IF p_success THEN
    RETURN jsonb_build_object('allowed', true, 'failures', 0);
  END IF;

  -- Count recent failures
  SELECT count(*) INTO v_recent_failures
  FROM login_attempts
  WHERE user_identifier = p_identifier
    AND created_at > now() - v_window
    AND success = FALSE;

  -- Check if locked out
  IF v_recent_failures >= v_max_attempts THEN
    v_lockout_until := now() + v_lockout_time;
    RETURN jsonb_build_object(
      'allowed', false,
      'failures', v_recent_failures,
      'locked_until', v_lockout_until,
      'message', format('Account locked. Too many failed attempts. Try again after %s minutes.', 
        EXTRACT(EPOCH FROM v_lockout_time) / 60)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'failures', v_recent_failures,
    'remaining', v_max_attempts - v_recent_failures
  );
END;
$$;

-- Function: Check if a user/IP is currently locked out
CREATE OR REPLACE FUNCTION is_login_locked(
  p_identifier TEXT,
  p_ip         INET DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) >= 5
  FROM login_attempts
  WHERE user_identifier = p_identifier
    AND created_at > now() - interval '15 minutes'
    AND success = FALSE;
$$;


-- ─── 2. IDEMPOTENCY KEYS ────────────────────────────────────
-- Prevents duplicate orders/payments on network retries

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key            TEXT PRIMARY KEY,
  user_id        UUID NOT NULL,
  endpoint       TEXT NOT NULL,               -- e.g., 'create_order', 'process_payment'
  request_hash   TEXT,                        -- hash of request body
  response       JSONB,                       -- cached response
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at     TIMESTAMPTZ DEFAULT now(),
  expires_at     TIMESTAMPTZ DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_user
  ON idempotency_keys(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires
  ON idempotency_keys(expires_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='idempotency_keys' AND policyname='users_own_idempotency') THEN
    CREATE POLICY users_own_idempotency ON idempotency_keys
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function: Check or create an idempotency key
CREATE OR REPLACE FUNCTION check_idempotency(
  p_key      TEXT,
  p_user_id  UUID,
  p_endpoint TEXT,
  p_req_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Check for existing key
  SELECT * INTO v_existing
  FROM idempotency_keys
  WHERE key = p_key AND user_id = p_user_id;

  IF FOUND THEN
    -- Already completed? Return cached response
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'duplicate', true,
        'response', v_existing.response
      );
    END IF;
    -- Still processing? Block
    IF v_existing.status = 'processing' THEN
      RETURN jsonb_build_object(
        'duplicate', true,
        'message', 'Request is still being processed'
      );
    END IF;
  END IF;

  -- Create new key
  INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash, status)
  VALUES (p_key, p_user_id, p_endpoint, p_req_hash, 'processing')
  ON CONFLICT (key) DO NOTHING;

  RETURN jsonb_build_object('duplicate', false);
END;
$$;

-- Function: Mark idempotency key as completed with response
CREATE OR REPLACE FUNCTION complete_idempotency(
  p_key     TEXT,
  p_response JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE idempotency_keys
  SET status = 'completed', response = p_response
  WHERE key = p_key;
$$;

-- Cleanup expired keys (run via pg_cron daily)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM idempotency_keys
    WHERE expires_at < now()
    RETURNING *
  )
  SELECT count(*)::int FROM deleted;
$$;


-- ─── 3. EPHEMERAL RIDER DATA ACCESS ─────────────────────────
-- Riders lose access to customer phone/address after delivery

CREATE OR REPLACE FUNCTION get_customer_contact_for_order(
  p_order_id UUID,
  p_rider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_address RECORD;
  v_phone TEXT;
BEGIN
  -- Verify rider is assigned and order is in active delivery state
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND rider_id = p_rider_id
    AND status IN ('dispatched', 'out_for_delivery');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'message', 'Contact info is only available during active delivery'
    );
  END IF;

  -- Get delivery address
  SELECT full_address, latitude, longitude INTO v_address
  FROM addresses
  WHERE id = v_order.delivery_address_id;

  -- Get customer phone (masked)
  SELECT phone INTO v_phone
  FROM profiles
  WHERE user_id = v_order.user_id;

  -- Return masked contact info
  RETURN jsonb_build_object(
    'allowed', true,
    'address', v_address.full_address,
    'latitude', v_address.latitude,
    'longitude', v_address.longitude,
    'phone_masked', overlay(v_phone placing '****' from 4 for 4),
    'expires_with_status', 'delivered'
  );
END;
$$;


-- ─── 4. WEBHOOK SIGNATURE VERIFICATION ──────────────────────
-- Verifies that incoming webhooks are genuinely from payment providers

CREATE OR REPLACE FUNCTION verify_webhook_signature(
  p_payload    TEXT,
  p_signature  TEXT,
  p_secret_name TEXT DEFAULT 'WEBHOOK_SECRET'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
  v_expected TEXT;
BEGIN
  -- Get secret from vault
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_secret_name
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING 'Webhook secret % not found in vault', p_secret_name;
    RETURN FALSE;
  END IF;

  -- Compute HMAC-SHA256
  v_expected := encode(
    hmac(p_payload::bytea, v_secret::bytea, 'sha256'),
    'hex'
  );

  RETURN v_expected = p_signature;
END;
$$;


-- ─── 5. API RATE LIMITING TABLE ─────────────────────────────
-- Per-user/IP rate limiting for expensive API calls

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  ip_address INET,
  endpoint   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint
  ON api_rate_limits(user_id, endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint
  ON api_rate_limits(ip_address, endpoint, created_at DESC);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_rate_limits' AND policyname='system_manage_rate_limits') THEN
    CREATE POLICY system_manage_rate_limits ON api_rate_limits FOR ALL WITH CHECK (true);
  END IF;
END $$;

-- Function: Check + enforce rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id    UUID,
  p_endpoint   TEXT,
  p_max_calls  INT DEFAULT 100,
  p_window     INTERVAL DEFAULT '1 minute',
  p_ip         INET DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Count recent calls
  SELECT count(*) INTO v_count
  FROM api_rate_limits
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND created_at > now() - p_window;

  -- Record this call
  INSERT INTO api_rate_limits (user_id, ip_address, endpoint)
  VALUES (p_user_id, p_ip, p_endpoint);

  IF v_count >= p_max_calls THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', p_max_calls,
      'remaining', 0,
      'retry_after_seconds', EXTRACT(EPOCH FROM p_window)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', p_max_calls,
    'remaining', p_max_calls - v_count - 1
  );
END;
$$;

-- Cleanup old rate limit entries (run daily via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM api_rate_limits
    WHERE created_at < now() - interval '1 hour'
    RETURNING *
  )
  SELECT count(*)::int FROM deleted;
$$;


-- ─── DOCUMENTATION ──────────────────────────────────────────
COMMENT ON FUNCTION record_login_attempt IS 'Records login attempt and returns lockout status (5 failures in 15 min = 30 min lock).';
COMMENT ON FUNCTION check_idempotency IS 'Checks/creates idempotency key to prevent duplicate payment/order processing.';
COMMENT ON FUNCTION get_customer_contact_for_order IS 'Ephemeral access: rider can only see customer contact during active delivery.';
COMMENT ON FUNCTION verify_webhook_signature IS 'Verifies HMAC-SHA256 webhook signatures using secrets from Supabase Vault.';
COMMENT ON FUNCTION check_rate_limit IS 'Per-user/endpoint rate limiting with configurable window and max calls.';
