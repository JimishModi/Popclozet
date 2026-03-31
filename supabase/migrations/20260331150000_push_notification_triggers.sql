-- Create extensions for sending HTTP requests asynchronously
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";

-- ============================================================================
-- 1. Webhook Function for Generic Table Changes
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_table_change_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url text := 'https://hfcdvcpgpkdgmcakgiuy.supabase.co/functions/v1/notification-webhook';
  payload jsonb;
  v_old jsonb := NULL;
  v_new jsonb := NULL;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_new := to_jsonb(NEW);
  END IF;

  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
  END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', v_new,
    'old_record', v_old
  );

  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'my_ultra_secure_internal_key_2026'
    ),
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Drop and Recreate Triggers on Orders
-- ============================================================================
DROP TRIGGER IF EXISTS trg_orders_notify_webhook ON orders;

CREATE TRIGGER trg_orders_notify_webhook
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_table_change_webhook();

-- ============================================================================
-- 3. Drop and Recreate Triggers on Return Requests
-- ============================================================================
DROP TRIGGER IF EXISTS trg_returns_notify_webhook ON return_requests;

CREATE TRIGGER trg_returns_notify_webhook
AFTER INSERT OR UPDATE ON return_requests
FOR EACH ROW
EXECUTE FUNCTION notify_table_change_webhook();

-- ============================================================================
-- 4. Set Up pg_cron for 1-Hour Database Event Ping
-- ============================================================================
-- Every 15 minutes, send a manual ping payload to the notification webhook 
-- so it can scan the database for 1-hour upcoming return times!
SELECT cron.unschedule('return_reminder_cron');

SELECT cron.schedule(
  'return_reminder_cron',
  '*/15 * * * *', -- Run every 15 minutes
  $$
    SELECT net.http_post(
      url := 'https://hfcdvcpgpkdgmcakgiuy.supabase.co/functions/v1/notification-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', 'my_ultra_secure_internal_key_2026'
      ),
      body := jsonb_build_object(
        'type', 'CRON',
        'table', 'system'
      )
    );
  $$
);
