-- =====================================================
-- PHASE 3: IMMUTABLE AUDIT LOG
-- Migration: 20260123_audit_log.sql
-- Purpose: Append-only audit log for state transitions and incidents
-- =====================================================

-- Create immutable audit log table
CREATE TABLE order_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Order context
  order_id UUID REFERENCES orders(id) NOT NULL,
  
  -- Actor information
  actor_id UUID NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('customer', 'rider', 'warehouse', 'admin', 'system')),
  
  -- State transition details
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  transition_result JSONB NOT NULL, -- { success, code, message }
  
  -- Telemetry snapshot (optional, for confidence tracking)
  -- Note: This is for ops visibility only, never customer-facing
  telemetry_snapshot JSONB DEFAULT NULL,
  confidence_score DOUBLE PRECISION DEFAULT NULL,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Immutable timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- IMMUTABILITY ENFORCEMENT
-- No UPDATE or DELETE allowed - append-only
-- =====================================================

-- Create indexes for efficient querying
CREATE INDEX idx_audit_log_order_id ON order_audit_log(order_id);
CREATE INDEX idx_audit_log_actor_id ON order_audit_log(actor_id);
CREATE INDEX idx_audit_log_actor_role ON order_audit_log(actor_role);
CREATE INDEX idx_audit_log_created_at ON order_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_from_to ON order_audit_log(from_status, to_status);

-- Enable RLS
ALTER TABLE order_audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Append-only, admin read-only
-- =====================================================

-- INSERT: Allow system and transition function to write
-- The SECURITY DEFINER function will insert audit records
CREATE POLICY "System can insert audit logs"
  ON order_audit_log FOR INSERT
  WITH CHECK (true); -- Controlled via SECURITY DEFINER function

-- SELECT: Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
  ON order_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- NO UPDATE POLICY - Immutable by design
-- NO DELETE POLICY - Immutable by design

-- =====================================================
-- INCIDENT LOG TABLE (Separate from audit for clarity)
-- =====================================================

CREATE TABLE incident_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Reference to original audit entry (optional)
  audit_log_id UUID REFERENCES order_audit_log(id),
  order_id UUID REFERENCES orders(id),
  
  -- Incident classification
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'low_confidence_telemetry',
    'unusual_transition_pattern',
    'location_mismatch',
    'time_anomaly',
    'manual_review_required'
  )),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Incident details
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Resolution tracking (ops-managed)
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_incident_log_order_id ON incident_log(order_id);
CREATE INDEX idx_incident_log_status ON incident_log(status);
CREATE INDEX idx_incident_log_severity ON incident_log(severity);
CREATE INDEX idx_incident_log_type ON incident_log(incident_type);

-- Enable RLS
ALTER TABLE incident_log ENABLE ROW LEVEL SECURITY;

-- RLS: Admins only
CREATE POLICY "Admins can read incidents"
  ON incident_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update incidents"
  ON incident_log FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Note: Incidents are created by system, not admins
CREATE POLICY "System can insert incidents"
  ON incident_log FOR INSERT
  WITH CHECK (true); -- Controlled via SECURITY DEFINER function

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON TABLE order_audit_log IS 
'Phase 3: Immutable audit log for all order state transitions.
APPEND-ONLY: No updates or deletes allowed.
Admin-only visibility. Customer/rider cannot access.';

COMMENT ON TABLE incident_log IS 
'Phase 3: Incident tracking for anomalies and manual review.
Linked to audit log entries. Admin-only access.
Incidents are informational, never block workflows.';

COMMENT ON COLUMN order_audit_log.telemetry_snapshot IS 
'Optional location data at transition time. For ops visibility only.
NEVER expose raw telemetry to customers.';

COMMENT ON COLUMN order_audit_log.confidence_score IS 
'Telemetry confidence at transition time (0.0-1.0).
Advisory only - low confidence does not block transitions.';
