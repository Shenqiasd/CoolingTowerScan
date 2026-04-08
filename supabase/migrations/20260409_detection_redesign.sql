-- Add annotated_url and review_status to scan_screenshots
ALTER TABLE scan_screenshots
  ADD COLUMN IF NOT EXISTS annotated_url text,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'confirmed', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_scan_screenshots_review
  ON scan_screenshots (review_status, detection_status);

CREATE INDEX IF NOT EXISTS idx_scan_screenshots_coords
  ON scan_screenshots (lng, lat)
  WHERE has_cooling_tower = true;

-- RPC for spatial enterprise matching
CREATE OR REPLACE FUNCTION match_enterprise_spatial(
  p_lng double precision,
  p_lat double precision,
  p_radius_m double precision DEFAULT 200
)
RETURNS TABLE(id uuid, enterprise_name text, address text, distance_m double precision)
LANGUAGE sql STABLE AS $$
  SELECT id, enterprise_name, address,
    ST_Distance(
      geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m
  FROM enterprises
  WHERE geom IS NOT NULL
    AND ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY distance_m
  LIMIT 5;
$$;
