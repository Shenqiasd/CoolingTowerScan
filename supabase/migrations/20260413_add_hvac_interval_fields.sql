ALTER TABLE enterprises
  ADD COLUMN IF NOT EXISTS detected_tower_total_area_m2 double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detected_tower_avg_area_m2 double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detected_tower_max_area_m2 double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hvac_estimate_details jsonb NOT NULL DEFAULT '{}'::jsonb;
