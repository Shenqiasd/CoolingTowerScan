/*
  # Wave 0 Foundation Backbone

  Adds the minimum pre-contract business backbone on top of the existing
  discovery schema:

  - `sites`
  - `scan_candidates`
  - `scan_candidate_evidences`
  - `leads`
  - `lead_confirmations`
  - `project_stage_states`
  - `workflow_audit_logs`

  Extends:

  - `projects.site_id`
  - `projects.lead_id`
  - `projects.project_code`
  - `projects.workflow_status`
*/

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  site_name text NOT NULL DEFAULT '',
  site_code text,
  address text NOT NULL DEFAULT '',
  normalized_address text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  longitude_gcj02 double precision,
  latitude_gcj02 double precision,
  coordinate_status text NOT NULL DEFAULT 'pending'
    CHECK (coordinate_status IN ('pending', 'success', 'failed')),
  coordinate_source text NOT NULL DEFAULT 'amap'
    CHECK (coordinate_source IN ('amap', 'manual', 'scan', 'import')),
  source_scan_session_id uuid REFERENCES scan_sessions(id) ON DELETE SET NULL,
  source_screenshot_id uuid REFERENCES scan_screenshots(id) ON DELETE SET NULL,
  is_primary boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_enterprise_primary_unique
  ON sites (enterprise_id, is_primary)
  WHERE is_primary = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_site_code_unique
  ON sites (site_code)
  WHERE site_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sites_enterprise ON sites (enterprise_id);
CREATE INDEX IF NOT EXISTS idx_sites_normalized_address ON sites (normalized_address);
CREATE INDEX IF NOT EXISTS idx_sites_city_district ON sites (city, district);

CREATE TABLE IF NOT EXISTS scan_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_code text NOT NULL,
  scan_session_id uuid REFERENCES scan_sessions(id) ON DELETE SET NULL,
  enterprise_id uuid REFERENCES enterprises(id) ON DELETE SET NULL,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'under_review', 'approved', 'rejected', 'needs_info', 'converted')),
  source_type text NOT NULL DEFAULT 'cooling_tower_scan'
    CHECK (source_type IN ('cooling_tower_scan', 'manual_upload', 'import')),
  source_label text NOT NULL DEFAULT '',
  matched_enterprise_name text NOT NULL DEFAULT '',
  matched_address text NOT NULL DEFAULT '',
  cooling_tower_count integer NOT NULL DEFAULT 0 CHECK (cooling_tower_count >= 0),
  total_tower_area_m2 double precision NOT NULL DEFAULT 0 CHECK (total_tower_area_m2 >= 0),
  total_tower_bbox_area_px double precision NOT NULL DEFAULT 0 CHECK (total_tower_bbox_area_px >= 0),
  estimated_capacity_rt double precision NOT NULL DEFAULT 0 CHECK (estimated_capacity_rt >= 0),
  estimated_cooling_station_power_kw double precision NOT NULL DEFAULT 0 CHECK (estimated_cooling_station_power_kw >= 0),
  confidence_score double precision NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  review_note text NOT NULL DEFAULT '',
  rejection_reason text NOT NULL DEFAULT '',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  hvac_estimate_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_candidates_code_unique
  ON scan_candidates (candidate_code);
CREATE INDEX IF NOT EXISTS idx_scan_candidates_status_created
  ON scan_candidates (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_candidates_enterprise
  ON scan_candidates (enterprise_id);
CREATE INDEX IF NOT EXISTS idx_scan_candidates_site
  ON scan_candidates (site_id);
CREATE INDEX IF NOT EXISTS idx_scan_candidates_session
  ON scan_candidates (scan_session_id);

CREATE TABLE IF NOT EXISTS scan_candidate_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES scan_candidates(id) ON DELETE CASCADE,
  screenshot_id uuid REFERENCES scan_screenshots(id) ON DELETE CASCADE,
  detection_result_id uuid REFERENCES detection_results(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('original', 'annotated', 'bbox', 'session_cover')),
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_candidate_evidences_candidate
  ON scan_candidate_evidences (candidate_id);
CREATE INDEX IF NOT EXISTS idx_scan_candidate_evidences_screenshot
  ON scan_candidate_evidences (screenshot_id);
CREATE INDEX IF NOT EXISTS idx_scan_candidate_evidences_detection
  ON scan_candidate_evidences (detection_result_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_candidate_evidences_unique_ref
  ON scan_candidate_evidences (
    candidate_id,
    COALESCE(screenshot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(detection_result_id, '00000000-0000-0000-0000-000000000000'::uuid),
    kind
  );

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code text NOT NULL,
  candidate_id uuid NOT NULL REFERENCES scan_candidates(id) ON DELETE RESTRICT,
  enterprise_id uuid NOT NULL REFERENCES enterprises(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('new', 'pending_confirmation', 'qualified', 'disqualified', 'on_hold', 'converted')),
  sales_owner_user_id uuid,
  technical_owner_user_id uuid,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  next_action text NOT NULL DEFAULT '',
  risk_summary text NOT NULL DEFAULT '',
  qualification_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_code_unique
  ON leads (lead_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_candidate_unique
  ON leads (candidate_id);
CREATE INDEX IF NOT EXISTS idx_leads_enterprise
  ON leads (enterprise_id);
CREATE INDEX IF NOT EXISTS idx_leads_site
  ON leads (site_id);
CREATE INDEX IF NOT EXISTS idx_leads_status_updated
  ON leads (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS lead_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  confirmation_role text NOT NULL
    CHECK (confirmation_role IN ('sales', 'technical')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  comment text NOT NULL DEFAULT '',
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_confirmations_role_unique
  ON lead_confirmations (lead_id, confirmation_role);
CREATE INDEX IF NOT EXISTS idx_lead_confirmations_status
  ON lead_confirmations (status);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_workflow_status_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_workflow_status_check
      CHECK (workflow_status IN ('active', 'blocked', 'on_hold', 'completed', 'cancelled'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_code_unique
  ON projects (project_code)
  WHERE project_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_site
  ON projects (site_id);
CREATE INDEX IF NOT EXISTS idx_projects_lead
  ON projects (lead_id);
CREATE INDEX IF NOT EXISTS idx_projects_workflow_status
  ON projects (workflow_status);

CREATE TABLE IF NOT EXISTS project_stage_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'blocked', 'pending_approval', 'completed', 'waived')),
  owner_user_id uuid,
  approver_user_id uuid,
  entered_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  gate_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_stage_states_unique_stage
  ON project_stage_states (project_id, stage_code);
CREATE INDEX IF NOT EXISTS idx_project_stage_states_status
  ON project_stage_states (status);
CREATE INDEX IF NOT EXISTS idx_project_stage_states_owner
  ON project_stage_states (owner_user_id);

CREATE TABLE IF NOT EXISTS workflow_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid NOT NULL,
  action text NOT NULL DEFAULT '',
  actor_user_id uuid,
  actor_source text NOT NULL DEFAULT 'api'
    CHECK (actor_source IN ('api', 'anonymous', 'system', 'migration')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_logs_entity
  ON workflow_audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_logs_action
  ON workflow_audit_logs (action, created_at DESC);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_candidate_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stage_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sites' AND policyname = 'auth_all_sites'
  ) THEN
    CREATE POLICY "auth_all_sites"
      ON sites FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scan_candidates' AND policyname = 'auth_all_scan_candidates'
  ) THEN
    CREATE POLICY "auth_all_scan_candidates"
      ON scan_candidates FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scan_candidate_evidences' AND policyname = 'auth_all_scan_candidate_evidences'
  ) THEN
    CREATE POLICY "auth_all_scan_candidate_evidences"
      ON scan_candidate_evidences FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads' AND policyname = 'auth_all_leads'
  ) THEN
    CREATE POLICY "auth_all_leads"
      ON leads FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_confirmations' AND policyname = 'auth_all_lead_confirmations'
  ) THEN
    CREATE POLICY "auth_all_lead_confirmations"
      ON lead_confirmations FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_stage_states' AND policyname = 'auth_all_project_stage_states'
  ) THEN
    CREATE POLICY "auth_all_project_stage_states"
      ON project_stage_states FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workflow_audit_logs' AND policyname = 'auth_all_workflow_audit_logs'
  ) THEN
    CREATE POLICY "auth_all_workflow_audit_logs"
      ON workflow_audit_logs FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sites_updated_at'
  ) THEN
    CREATE TRIGGER sites_updated_at
      BEFORE UPDATE ON sites
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'scan_candidates_updated_at'
  ) THEN
    CREATE TRIGGER scan_candidates_updated_at
      BEFORE UPDATE ON scan_candidates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'scan_candidate_evidences_updated_at'
  ) THEN
    CREATE TRIGGER scan_candidate_evidences_updated_at
      BEFORE UPDATE ON scan_candidate_evidences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'leads_updated_at'
  ) THEN
    CREATE TRIGGER leads_updated_at
      BEFORE UPDATE ON leads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'lead_confirmations_updated_at'
  ) THEN
    CREATE TRIGGER lead_confirmations_updated_at
      BEFORE UPDATE ON lead_confirmations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'project_stage_states_updated_at'
  ) THEN
    CREATE TRIGGER project_stage_states_updated_at
      BEFORE UPDATE ON project_stage_states
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'workflow_audit_logs_updated_at'
  ) THEN
    CREATE TRIGGER workflow_audit_logs_updated_at
      BEFORE UPDATE ON workflow_audit_logs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
