-- ==============================================================================
-- NEXSTORM — PostgreSQL / Supabase Schema Migration: Alert Subsystem
-- File: supabase/migrations/20261015_create_alert_subsystems.sql
-- Version: 1.0.0
-- Purpose: Durable subscriber preferences, alert decision audit trails,
--          geofenced target matching, and auditable delivery queue.
-- ==============================================================================

-- 1. Create Subscribers Table
CREATE TABLE IF NOT EXISTS public.alert_subscribers (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id VARCHAR(32) NOT NULL DEFAULT 'amritsar',
  channel VARCHAR(16) NOT NULL CHECK (channel IN ('email', 'sms', 'webhook')),
  destination TEXT NOT NULL,
  sensitivity VARCHAR(32) NOT NULL DEFAULT 'moderate_sensitivity' CHECK (sensitivity IN ('high_sensitivity', 'moderate_sensitivity', 'high_risk', 'extreme')),
  
  -- Geofencing targeting criteria
  geofence_type VARCHAR(16) NOT NULL DEFAULT 'citywide' CHECK (geofence_type IN ('citywide', 'cells', 'corridor', 'bbox')),
  target_cells TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_corridor VARCHAR(64),
  target_bbox DOUBLE PRECISION[], -- [minLon, minLat, maxLon, maxLat]
  geofence_geom geometry(Geometry, 4326), -- PostGIS spatial geometry for polygon/bbox containment
  
  -- Quiet hours configuration
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_start_hour INT CHECK (quiet_start_hour >= 0 AND quiet_start_hour <= 23),
  quiet_end_hour INT CHECK (quiet_end_hour >= 0 AND quiet_end_hour <= 23),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  
  -- Consent and verification lifecycle
  is_opted_in BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_test_subscriber BOOLEAN NOT NULL DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: prevent duplicate registrations for the same destination & city
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_unique_dest ON public.alert_subscribers (city_id, channel, destination) WHERE is_opted_in = TRUE;
CREATE INDEX IF NOT EXISTS idx_subscribers_city_optin ON public.alert_subscribers (city_id, is_opted_in);
CREATE INDEX IF NOT EXISTS idx_subscribers_sensitivity ON public.alert_subscribers (sensitivity);
CREATE INDEX IF NOT EXISTS idx_subscribers_geom ON public.alert_subscribers USING GIST (geofence_geom);

-- 2. Create Alert Decisions Table (Audit Log of Model Evaluations)
CREATE TABLE IF NOT EXISTS public.alert_decisions (
  id VARCHAR(64) PRIMARY KEY,
  city_id VARCHAR(32) NOT NULL DEFAULT 'amritsar',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision_state VARCHAR(32) NOT NULL CHECK (decision_state IN ('normal', 'elevated_risk', 'severe_risk', 'stale_data', 'unavailable_weather', 'evaluation_failure')),
  sensitivity VARCHAR(32) NOT NULL,
  threshold_applied DOUBLE PRECISION NOT NULL,
  max_rti DOUBLE PRECISION NOT NULL,
  highest_risk_category VARCHAR(16) NOT NULL,
  weather_source TEXT NOT NULL,
  weather_freshness JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_degraded BOOLEAN NOT NULL DEFAULT FALSE,
  is_permitted BOOLEAN NOT NULL DEFAULT FALSE,
  suppression_reason TEXT,
  reason TEXT NOT NULL,
  affected_cells TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  affected_road_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  model_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_city_time ON public.alert_decisions (city_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_state ON public.alert_decisions (decision_state);

-- 3. Create Alert Deliveries Queue Table
CREATE TABLE IF NOT EXISTS public.alert_deliveries (
  id VARCHAR(64) PRIMARY KEY,
  decision_id VARCHAR(64) NOT NULL REFERENCES public.alert_decisions(id) ON DELETE CASCADE,
  subscriber_id VARCHAR(64) NOT NULL REFERENCES public.alert_subscribers(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  channel VARCHAR(16) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'suppressed', 'failed', 'dead_letter')),
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failure_reason TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.alert_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_deliveries_subscriber_time ON public.alert_deliveries (subscriber_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_decision ON public.alert_deliveries (decision_id);

-- 4. Row Level Security (RLS) Policies
ALTER TABLE public.alert_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY;

-- Subscribers:
-- Authenticated users can manage their own subscription record.
CREATE POLICY "Subscribers can manage own preference"
  ON public.alert_subscribers
  FOR ALL
  USING (auth.uid() = user_id);

-- Service role has full administrative access.
CREATE POLICY "Service role full access subscribers"
  ON public.alert_subscribers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Decisions:
-- Public can read non-internal decision summaries.
CREATE POLICY "Public read decisions"
  ON public.alert_decisions
  FOR SELECT
  USING (is_permitted = TRUE);

CREATE POLICY "Service role full access decisions"
  ON public.alert_decisions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Deliveries:
-- Restricted to service role only.
CREATE POLICY "Service role full access deliveries"
  ON public.alert_deliveries
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.alert_subscribers IS 'NEXSTORM verified subscriber preferences, channels, geofences, and opt-in consent.';
COMMENT ON TABLE public.alert_decisions IS 'NEXSTORM audit trail of server-computed alert decisions and weather freshness qualifications.';
COMMENT ON TABLE public.alert_deliveries IS 'NEXSTORM durable alert dispatch queue with idempotency keys and retry tracking.';
