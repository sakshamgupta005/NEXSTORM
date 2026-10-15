-- ==============================================================================
-- NEXSTORM — PostgreSQL / Supabase Schema Migration: Observations
-- File: supabase/migrations/20261015_create_observations.sql
-- Version: 1.0.0
-- Purpose: Durable shared persistence for citizen waterlogging reports,
--          spatial snapping, lifecycle state machine, and moderation audit trail.
-- ==============================================================================

-- 1. Enable PostGIS extension if available (optional for geospatial indexing)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create canonical observations table
CREATE TABLE IF NOT EXISTS public.observations (
  id VARCHAR(64) PRIMARY KEY,
  schema_version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
  city_id VARCHAR(32) NOT NULL DEFAULT 'amritsar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  
  -- Geographic Coordinates (WGS84 EPSG:4326)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- Spatial matching references
  cell_id VARCHAR(32),
  road_segment_id VARCHAR(64),
  road_name TEXT,
  spatial_match JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Observation payload
  category VARCHAR(32) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  description TEXT,
  photo_url TEXT,
  
  -- Cryptographic privacy & provenance
  reporter_hash VARCHAR(32) NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'community_submission',
  lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  
  -- Lifecycle & verification sub-objects
  verification JSONB NOT NULL DEFAULT '{"isVerified": false, "verifiedAt": null, "verifiedBy": null, "verificationMethod": null, "verificationNotes": null}'::jsonb,
  corroboration JSONB NOT NULL DEFAULT '{"corroborationCount": 1, "corroboratingObservationIds": [], "lastCorroboratedAt": null}'::jsonb,
  freshness JSONB NOT NULL DEFAULT '{"isStale": false, "isExpired": false, "expiresAt": null}'::jsonb,
  scientific_caveat TEXT NOT NULL DEFAULT 'Community waterlogging observation. Does NOT represent an official emergency broadcast or verified flood depth.'
);

-- 3. Create high-performance query indexes
CREATE INDEX IF NOT EXISTS idx_observations_city_status ON public.observations (city_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_observations_observed_at ON public.observations (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_cell_id ON public.observations (cell_id) WHERE cell_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_observations_road_segment ON public.observations (road_segment_id) WHERE road_segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_observations_reporter_window ON public.observations (reporter_hash, submitted_at DESC);

-- PostGIS spatial index if PostGIS is installed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_observations_geom ON public.observations USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326))';
  END IF;
END $$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;

-- Policy A: Public read access to active (non-rejected) observations
CREATE POLICY "Public read active observations"
  ON public.observations
  FOR SELECT
  USING (lifecycle_status <> 'rejected');

-- Policy B: Service role / Admin full read access including rejected audit logs
CREATE POLICY "Service role full access"
  ON public.observations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy C: Public rate-limited submission
CREATE POLICY "Public insert community observation"
  ON public.observations
  FOR INSERT
  WITH CHECK (
    source_type = 'community_submission' 
    AND lifecycle_status = 'submitted'
  );

COMMENT ON TABLE public.observations IS 'NEXSTORM ground-truth citizen waterlogging reports, spatial snapping references, and moderation audit logs.';
