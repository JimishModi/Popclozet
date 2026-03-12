-- ============================================================
-- Incident Alerting & Automated Monitoring
-- ============================================================
-- Fully self-contained. Does NOT depend on any other migration.
-- Creates incident_log, alert_queue, triggers, and helpers.
-- ============================================================

-- ─── Admin check helper (works even if profiles table is missing) ─
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if profiles table exists and has a role column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  = 'profiles'
      AND column_name = 'role'
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    );
  END IF;
  -- Fallback: no profiles table, deny admin access
  RETURN FALSE;
END;
$$;

-- ─── Incident log table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS incident_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id    UUID,
  order_id        UUID,
  incident_type   TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'low'
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description     TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolved_by     UUID,
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  actor_id        UUID,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE incident_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_incident_log_severity   ON incident_log(severity);
CREATE INDEX IF NOT EXISTS idx_incident_log_status     ON incident_log(status);
CREATE INDEX IF NOT EXISTS idx_incident_log_created_at ON incident_log(created_at DESC);

-- RLS: use the is_admin() helper so we never reference profiles.role directly
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incident_log' AND policyname='admin_read_incidents') THEN
    CREATE POLICY admin_read_incidents ON incident_log FOR SELECT USING (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incident_log' AND policyname='admin_update_incidents') THEN
    CREATE POLICY admin_update_incidents ON incident_log FOR UPDATE USING (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incident_log' AND policyname='system_insert_incidents') THEN
    CREATE POLICY system_insert_incidents ON incident_log FOR INSERT WITH CHECK (true);
  END IF;
END $$;


-- ─── Alert queue table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID REFERENCES incident_log(id),
  severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  alert_type      TEXT NOT NULL,
  message         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  acknowledged    BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE alert_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_queue' AND policyname='admin_read_alerts') THEN
    CREATE POLICY admin_read_alerts ON alert_queue FOR SELECT USING (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_queue' AND policyname='admin_update_alerts') THEN
    CREATE POLICY admin_update_alerts ON alert_queue FOR UPDATE USING (is_admin());
  END IF;
END $$;


-- ─── Auto-alert trigger on high/critical incidents ───────────
CREATE OR REPLACE FUNCTION fn_auto_alert_on_incident()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity IN ('high', 'critical') THEN
    INSERT INTO alert_queue (incident_id, severity, alert_type, message, metadata)
    VALUES (
      NEW.id,
      NEW.severity,
      NEW.incident_type,
      format('%s incident: %s', upper(NEW.severity), NEW.description),
      jsonb_build_object(
        'incident_type', NEW.incident_type,
        'order_id', NEW.order_id,
        'actor_id', NEW.actor_id,
        'created_at', NEW.created_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_alert ON incident_log;
CREATE TRIGGER trg_auto_alert
  AFTER INSERT ON incident_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_alert_on_incident();


-- ─── Suspicious pattern detection ────────────────────────────
CREATE OR REPLACE FUNCTION detect_suspicious_patterns(
  time_window INTERVAL DEFAULT '15 minutes',
  threshold   INT     DEFAULT 5
)
RETURNS TABLE (
  suspect_actor_id UUID,
  incident_count   BIGINT,
  severities       TEXT[],
  window_start     TIMESTAMPTZ,
  window_end       TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    il.actor_id    AS suspect_actor_id,
    count(*)       AS incident_count,
    array_agg(DISTINCT il.severity) AS severities,
    now() - time_window AS window_start,
    now()          AS window_end
  FROM incident_log il
  WHERE il.created_at >= now() - time_window
    AND il.actor_id IS NOT NULL
  GROUP BY il.actor_id
  HAVING count(*) >= threshold
  ORDER BY incident_count DESC;
$$;


-- ─── Daily summary view ─────────────────────────────────────
CREATE OR REPLACE VIEW incident_daily_summary AS
SELECT
  date_trunc('day', created_at) AS day,
  severity,
  incident_type,
  count(*)                      AS total_incidents,
  count(DISTINCT order_id)      AS affected_orders,
  count(DISTINCT actor_id)      AS unique_actors
FROM incident_log
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2, 3;

GRANT SELECT ON incident_daily_summary TO authenticated;


-- ─── Documentation ──────────────────────────────────────────
COMMENT ON FUNCTION is_admin IS 'Safely checks if current user is admin. Works even if profiles table has no role column.';
COMMENT ON TABLE alert_queue IS 'Actionable alerts auto-generated from high/critical incidents. Admin-only.';
COMMENT ON FUNCTION fn_auto_alert_on_incident IS 'Trigger: auto-creates alert on high/critical incidents.';
COMMENT ON FUNCTION detect_suspicious_patterns IS 'Finds actors with repeated incidents in a time window.';
