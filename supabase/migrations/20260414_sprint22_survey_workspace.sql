/*
  # Sprint 2.2 Survey Workspace

  Adds structured reusable project assets for survey operations:

  - `project_equipment_ledger_items`
  - `project_data_gaps`
  - `project_handoffs`
*/

CREATE TABLE IF NOT EXISTS project_equipment_ledger_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  equipment_name text NOT NULL DEFAULT '',
  equipment_type text NOT NULL DEFAULT '',
  location_label text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  capacity_rt double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'running', 'standby', 'offline')),
  notes text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_equipment_ledger_items_project
  ON project_equipment_ledger_items (project_id, created_at);

CREATE TABLE IF NOT EXISTS project_data_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_code text NOT NULL DEFAULT 'survey',
  gap_type text NOT NULL DEFAULT 'missing_info'
    CHECK (gap_type IN ('missing_info', 'risk', 'waiver')),
  title text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'waived')),
  owner_user_id uuid,
  due_at timestamptz,
  waiver_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_data_gaps_project
  ON project_data_gaps (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_data_gaps_status
  ON project_data_gaps (status);

CREATE TABLE IF NOT EXISTS project_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage text NOT NULL DEFAULT 'survey',
  to_stage text NOT NULL DEFAULT 'proposal',
  title text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'completed', 'waived')),
  owner_user_id uuid,
  due_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_handoffs_project
  ON project_handoffs (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_handoffs_status
  ON project_handoffs (status);

ALTER TABLE project_equipment_ledger_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_data_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_handoffs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_equipment_ledger_items'
      AND policyname = 'auth_all_project_equipment_ledger_items'
  ) THEN
    CREATE POLICY "auth_all_project_equipment_ledger_items"
      ON project_equipment_ledger_items FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_data_gaps'
      AND policyname = 'auth_all_project_data_gaps'
  ) THEN
    CREATE POLICY "auth_all_project_data_gaps"
      ON project_data_gaps FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_handoffs'
      AND policyname = 'auth_all_project_handoffs'
  ) THEN
    CREATE POLICY "auth_all_project_handoffs"
      ON project_handoffs FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'project_equipment_ledger_items_updated_at'
  ) THEN
    CREATE TRIGGER project_equipment_ledger_items_updated_at
      BEFORE UPDATE ON project_equipment_ledger_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'project_data_gaps_updated_at'
  ) THEN
    CREATE TRIGGER project_data_gaps_updated_at
      BEFORE UPDATE ON project_data_gaps
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'project_handoffs_updated_at'
  ) THEN
    CREATE TRIGGER project_handoffs_updated_at
      BEFORE UPDATE ON project_handoffs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
