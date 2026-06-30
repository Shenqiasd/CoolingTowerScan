/*
  # HVAC Survey Workspace

  Adds the structured HVAC survey data layer used by project survey:

  - project_cooling_stations
  - project_survey_files
  - project_hvac_equipment_assets
  - project_operation_records
  - project_equipment_monthly_profiles
  - project_hvac_evaluations
  - hvac_saving_mode_configs
*/

CREATE TABLE IF NOT EXISTS project_cooling_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_label text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_cooling_stations_project
  ON project_cooling_stations (project_id, created_at);

CREATE TABLE IF NOT EXISTS project_survey_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  station_id uuid REFERENCES project_cooling_stations(id) ON DELETE SET NULL,
  file_type text NOT NULL
    CHECK (file_type IN ('device_nameplate', 'device_ledger', 'operation_record', 'site_photo', 'other')),
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'survey-files',
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  extraction_status text NOT NULL DEFAULT 'uploaded'
    CHECK (extraction_status IN ('uploaded', 'extracting', 'needs_review', 'reviewed', 'failed')),
  confidence numeric,
  error_message text NOT NULL DEFAULT '',
  raw_extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_survey_files_project
  ON project_survey_files (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_survey_files_project_station
  ON project_survey_files (project_id, station_id);
CREATE INDEX IF NOT EXISTS idx_project_survey_files_project_status
  ON project_survey_files (project_id, extraction_status);

CREATE TABLE IF NOT EXISTS project_hvac_equipment_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  station_id uuid REFERENCES project_cooling_stations(id) ON DELETE SET NULL,
  source_file_id uuid REFERENCES project_survey_files(id) ON DELETE SET NULL,
  device_type text NOT NULL DEFAULT 'unknown'
    CHECK (device_type IN ('chiller', 'chilled_water_pump', 'cooling_water_pump', 'cooling_tower', 'unknown')),
  equipment_name text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rated_power_kw numeric CHECK (rated_power_kw IS NULL OR rated_power_kw > 0),
  rated_cooling_capacity_kw numeric CHECK (rated_cooling_capacity_kw IS NULL OR rated_cooling_capacity_kw > 0),
  rated_cop numeric CHECK (rated_cop IS NULL OR rated_cop > 0),
  frequency_hz numeric CHECK (frequency_hz IS NULL OR frequency_hz > 0),
  head_m numeric CHECK (head_m IS NULL OR head_m > 0),
  flow_rate_m3h numeric CHECK (flow_rate_m3h IS NULL OR flow_rate_m3h > 0),
  heat_exchange_capacity_kw numeric CHECK (heat_exchange_capacity_kw IS NULL OR heat_exchange_capacity_kw > 0),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('unknown', 'running', 'standby', 'offline')),
  review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  confidence numeric,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_hvac_equipment_assets_project
  ON project_hvac_equipment_assets (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_hvac_equipment_assets_project_station
  ON project_hvac_equipment_assets (project_id, station_id);
CREATE INDEX IF NOT EXISTS idx_project_hvac_equipment_assets_project_review
  ON project_hvac_equipment_assets (project_id, review_status);

CREATE TABLE IF NOT EXISTS project_operation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  station_id uuid REFERENCES project_cooling_stations(id) ON DELETE SET NULL,
  source_file_id uuid REFERENCES project_survey_files(id) ON DELETE SET NULL,
  record_date date,
  record_time text NOT NULL DEFAULT '',
  shift text NOT NULL DEFAULT '',
  operating_status text NOT NULL DEFAULT '',
  operating_hours numeric CHECK (operating_hours IS NULL OR operating_hours >= 0),
  units_on_count integer CHECK (units_on_count IS NULL OR units_on_count >= 0),
  operating_current_pct numeric CHECK (operating_current_pct IS NULL OR (operating_current_pct >= 0 AND operating_current_pct <= 100)),
  load_rate_pct numeric CHECK (load_rate_pct IS NULL OR (load_rate_pct >= 0 AND load_rate_pct <= 100)),
  measured_energy_kwh numeric CHECK (measured_energy_kwh IS NULL OR measured_energy_kwh >= 0),
  notes text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_operation_records_project
  ON project_operation_records (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_operation_records_project_station
  ON project_operation_records (project_id, station_id);
CREATE INDEX IF NOT EXISTS idx_project_operation_records_project_review
  ON project_operation_records (project_id, review_status);

CREATE TABLE IF NOT EXISTS project_equipment_monthly_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  equipment_asset_id uuid NOT NULL REFERENCES project_hvac_equipment_assets(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  run_num integer NOT NULL DEFAULT 0 CHECK (run_num >= 0),
  month_days integer NOT NULL CHECK (month_days BETWEEN 1 AND 31),
  run_days integer NOT NULL DEFAULT 0 CHECK (run_days >= 0 AND run_days <= month_days),
  run_day_hours numeric NOT NULL DEFAULT 0 CHECK (run_day_hours >= 0 AND run_day_hours <= 24),
  load_rate_pct numeric NOT NULL DEFAULT 0 CHECK (load_rate_pct >= 0 AND load_rate_pct <= 100),
  operation_strategy text NOT NULL DEFAULT 'partial_year'
    CHECK (operation_strategy IN ('full_year', 'partial_year')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipment_asset_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_project_equipment_monthly_profiles_project
  ON project_equipment_monthly_profiles (project_id, year, month);
CREATE INDEX IF NOT EXISTS idx_project_equipment_monthly_profiles_asset
  ON project_equipment_monthly_profiles (equipment_asset_id, year, month);

CREATE TABLE IF NOT EXISTS project_hvac_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  saving_mode text NOT NULL CHECK (saving_mode IN ('winter', 'balanced', 'summer', 'extreme')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_hvac_evaluations_project
  ON project_hvac_evaluations (project_id, year, created_at DESC);

CREATE TABLE IF NOT EXISTS hvac_saving_mode_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saving_mode text NOT NULL CHECK (saving_mode IN ('winter', 'balanced', 'summer', 'extreme')),
  device_type text NOT NULL CHECK (device_type IN ('chiller', 'chilled_water_pump', 'cooling_water_pump', 'cooling_tower')),
  avg_base numeric NOT NULL CHECK (avg_base >= 0 AND avg_base <= 1),
  rate1 numeric NOT NULL CHECK (rate1 >= 0),
  rate2 numeric NOT NULL CHECK (rate2 >= 0),
  rate3 numeric NOT NULL CHECK (rate3 >= 0),
  rate4 numeric NOT NULL CHECK (rate4 >= 0),
  rate5 numeric NOT NULL CHECK (rate5 >= 0),
  rate6 numeric NOT NULL CHECK (rate6 >= 0),
  rate7 numeric NOT NULL CHECK (rate7 >= 0),
  rate8 numeric NOT NULL CHECK (rate8 >= 0),
  rate9 numeric NOT NULL CHECK (rate9 >= 0),
  rate10 numeric NOT NULL CHECK (rate10 >= 0),
  rate11 numeric NOT NULL CHECK (rate11 >= 0),
  rate12 numeric NOT NULL CHECK (rate12 >= 0),
  UNIQUE (saving_mode, device_type)
);

ALTER TABLE project_cooling_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_survey_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_hvac_equipment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_operation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_equipment_monthly_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_hvac_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hvac_saving_mode_configs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table_name text;
  v_policy_name text;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'project_cooling_stations',
    'project_survey_files',
    'project_hvac_equipment_assets',
    'project_operation_records',
    'project_equipment_monthly_profiles',
    'project_hvac_evaluations',
    'hvac_saving_mode_configs'
  ]
  LOOP
    v_policy_name := 'auth_all_' || v_table_name;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = v_table_name
        AND policyname = v_policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        v_policy_name,
        v_table_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_table_name text;
  v_trigger_name text;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'project_cooling_stations',
    'project_survey_files',
    'project_hvac_equipment_assets',
    'project_operation_records',
    'project_equipment_monthly_profiles'
  ]
  LOOP
    v_trigger_name := v_table_name || '_updated_at';
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = v_trigger_name
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        v_trigger_name,
        v_table_name
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO hvac_saving_mode_configs (
  saving_mode,
  device_type,
  avg_base,
  rate1,
  rate2,
  rate3,
  rate4,
  rate5,
  rate6,
  rate7,
  rate8,
  rate9,
  rate10,
  rate11,
  rate12
)
VALUES
  ('winter', 'chiller', 0.080, 1.20, 1.20, 1.05, 0.90, 0.80, 0.75, 0.70, 0.70, 0.80, 0.95, 1.15, 1.20),
  ('winter', 'chilled_water_pump', 0.060, 1.20, 1.20, 1.05, 0.90, 0.80, 0.75, 0.70, 0.70, 0.80, 0.95, 1.15, 1.20),
  ('winter', 'cooling_water_pump', 0.060, 1.20, 1.20, 1.05, 0.90, 0.80, 0.75, 0.70, 0.70, 0.80, 0.95, 1.15, 1.20),
  ('winter', 'cooling_tower', 0.070, 1.20, 1.20, 1.05, 0.90, 0.80, 0.75, 0.70, 0.70, 0.80, 0.95, 1.15, 1.20),
  ('balanced', 'chiller', 0.080, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00),
  ('balanced', 'chilled_water_pump', 0.060, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00),
  ('balanced', 'cooling_water_pump', 0.060, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00),
  ('balanced', 'cooling_tower', 0.070, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00),
  ('summer', 'chiller', 0.080, 0.70, 0.70, 0.80, 0.95, 1.10, 1.20, 1.25, 1.25, 1.10, 0.95, 0.80, 0.70),
  ('summer', 'chilled_water_pump', 0.060, 0.70, 0.70, 0.80, 0.95, 1.10, 1.20, 1.25, 1.25, 1.10, 0.95, 0.80, 0.70),
  ('summer', 'cooling_water_pump', 0.060, 0.70, 0.70, 0.80, 0.95, 1.10, 1.20, 1.25, 1.25, 1.10, 0.95, 0.80, 0.70),
  ('summer', 'cooling_tower', 0.070, 0.70, 0.70, 0.80, 0.95, 1.10, 1.20, 1.25, 1.25, 1.10, 0.95, 0.80, 0.70),
  ('extreme', 'chiller', 0.100, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10),
  ('extreme', 'chilled_water_pump', 0.080, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10),
  ('extreme', 'cooling_water_pump', 0.080, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10),
  ('extreme', 'cooling_tower', 0.090, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10)
ON CONFLICT (saving_mode, device_type) DO NOTHING;
