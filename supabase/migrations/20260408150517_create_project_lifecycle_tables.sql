/*
  # Project Lifecycle Tables

  空调交付全流程数字化平台 — 项目生命周期数据模型

  1. New Tables
    - `projects` — 贯穿全生命周期的项目主表
    - `agent_tasks` — AI Agent 交互记录
    - `project_documents` — 项目文档（方案/合同/报告等）

  2. Enums
    - `sop_phase` — SOP 阶段枚举
    - `agent_type` — Agent 类型枚举
*/

-- SOP 阶段枚举
CREATE TYPE sop_phase AS ENUM (
  'prospecting',      -- 线索发现（CoolingTowerScan）
  'qualification',    -- 资质筛选（售前资质助手）
  'survey',           -- 踏勘调研
  'proposal',         -- 方案报价（方案生成助手）
  'bidding',          -- 投标签约（投标合同助手）
  'execution',        -- 实施交付（计划与采购助手）
  'commissioning',    -- 调试验收（培训·验收助手）
  'operations'        -- 运维回款（智慧运维助手）
);

-- Agent 类型枚举
CREATE TYPE agent_type AS ENUM (
  'pre_sales_qualification',  -- 售前资质助手
  'solution_generation',      -- 方案生成助手
  'bid_contract',             -- 投标合同助手
  'project_execution',        -- 计划与采购助手
  'training_acceptance',      -- 培训·验收助手
  'smart_om'                  -- 智慧运维助手
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid REFERENCES enterprises(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  current_phase sop_phase NOT NULL DEFAULT 'prospecting',

  -- 各阶段结构化数据
  phase_data jsonb NOT NULL DEFAULT '{
    "prospecting": {},
    "qualification": {},
    "survey": {},
    "proposal": {},
    "bidding": {},
    "execution": {},
    "commissioning": {},
    "operations": {}
  }'::jsonb,

  -- 商机评分（售前阶段产出）
  opportunity_score numeric DEFAULT 0,
  priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

  -- 归属
  assigned_to text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_projects_enterprise ON projects (enterprise_id);
CREATE INDEX idx_projects_phase ON projects (current_phase);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_priority ON projects (priority);

-- Agent 任务表
CREATE TABLE IF NOT EXISTS agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent agent_type NOT NULL,
  phase sop_phase NOT NULL,

  -- 输入输出
  input jsonb NOT NULL DEFAULT '{}',
  output jsonb DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error text,

  -- LLM 使用记录
  llm_model text,
  tokens_used integer DEFAULT 0,
  duration_ms integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_agent_tasks_project ON agent_tasks (project_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks (status);
CREATE INDEX idx_agent_tasks_agent ON agent_tasks (agent);

-- 项目文档表
CREATE TABLE IF NOT EXISTS project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase sop_phase NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',  -- proposal, contract, report, bom, etc.
  title text NOT NULL DEFAULT '',
  storage_path text,                        -- Supabase Storage path
  metadata jsonb DEFAULT '{}',
  version integer DEFAULT 1,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_project_documents_project ON project_documents (project_id);
CREATE INDEX idx_project_documents_phase ON project_documents (phase);

-- RLS policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Projects: anon read, authenticated full access
CREATE POLICY "anon_read_projects" ON projects FOR SELECT TO anon USING (true);
CREATE POLICY "auth_all_projects" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Agent tasks: anon read, authenticated full access
CREATE POLICY "anon_read_agent_tasks" ON agent_tasks FOR SELECT TO anon USING (true);
CREATE POLICY "auth_all_agent_tasks" ON agent_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Project documents: anon read, authenticated full access
CREATE POLICY "anon_read_project_documents" ON project_documents FOR SELECT TO anon USING (true);
CREATE POLICY "auth_all_project_documents" ON project_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER project_documents_updated_at
  BEFORE UPDATE ON project_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC: 从企业创建项目（自动填充 prospecting 阶段数据）
CREATE OR REPLACE FUNCTION create_project_from_enterprise(p_enterprise_id uuid)
RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_project_id uuid;
  v_enterprise enterprises%ROWTYPE;
BEGIN
  SELECT * INTO v_enterprise FROM enterprises WHERE id = p_enterprise_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enterprise not found: %', p_enterprise_id;
  END IF;

  INSERT INTO projects (enterprise_id, name, current_phase, phase_data)
  VALUES (
    p_enterprise_id,
    v_enterprise.enterprise_name,
    'prospecting',
    jsonb_build_object(
      'prospecting', jsonb_build_object(
        'has_cooling_tower', v_enterprise.has_cooling_tower,
        'cooling_tower_count', v_enterprise.cooling_tower_count,
        'detection_confidence', v_enterprise.detection_confidence,
        'total_cooling_capacity_rt', v_enterprise.total_cooling_capacity_rt,
        'probability_level', v_enterprise.probability_level,
        'composite_score', v_enterprise.composite_score
      ),
      'qualification', '{}'::jsonb,
      'survey', '{}'::jsonb,
      'proposal', '{}'::jsonb,
      'bidding', '{}'::jsonb,
      'execution', '{}'::jsonb,
      'commissioning', '{}'::jsonb,
      'operations', '{}'::jsonb
    )
  )
  RETURNING id INTO v_project_id;

  RETURN v_project_id;
END;
$$;
