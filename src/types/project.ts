// SOP 阶段定义
export const SOP_PHASES = [
  'prospecting',
  'qualification',
  'survey',
  'proposal',
  'bidding',
  'execution',
  'commissioning',
  'operations',
] as const;

export type SopPhase = typeof SOP_PHASES[number];

export const SOP_PHASE_LABELS: Record<SopPhase, string> = {
  prospecting: '线索发现',
  qualification: '资质筛选',
  survey: '踏勘调研',
  proposal: '方案报价',
  bidding: '投标签约',
  execution: '实施交付',
  commissioning: '调试验收',
  operations: '运维回款',
};

// Agent 类型
export const AGENT_TYPES = [
  'pre_sales_qualification',
  'solution_generation',
  'bid_contract',
  'project_execution',
  'training_acceptance',
  'smart_om',
] as const;

export type AgentType = typeof AGENT_TYPES[number];

export const AGENT_LABELS: Record<AgentType, string> = {
  pre_sales_qualification: '售前资质助手',
  solution_generation: '方案生成助手',
  bid_contract: '投标合同助手',
  project_execution: '计划与采购助手',
  training_acceptance: '培训·验收助手',
  smart_om: '智慧运维助手',
};

// Agent 对应的 SOP 阶段
export const AGENT_PHASE_MAP: Record<AgentType, SopPhase[]> = {
  pre_sales_qualification: ['prospecting', 'qualification'],
  solution_generation: ['survey', 'proposal'],
  bid_contract: ['bidding'],
  project_execution: ['execution'],
  training_acceptance: ['commissioning'],
  smart_om: ['operations'],
};

// 项目
export interface Project {
  id: string;
  project_code?: string;
  lead_id?: string;
  enterprise_id: string | null;
  site_id?: string | null;
  name: string;
  current_phase: SopPhase;
  current_stage_code?: SopPhase;
  current_stage_status?: 'not_started' | 'in_progress' | 'blocked' | 'pending_approval' | 'completed' | 'waived';
  phase_data: Record<SopPhase, Record<string, unknown>>;
  opportunity_score: number;
  priority: 'high' | 'medium' | 'low';
  assigned_to: string | null;
  status: 'active' | 'blocked' | 'on_hold' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  // joined fields
  enterprise?: {
    enterprise_name: string;
    address: string;
    industry_category: string;
    has_cooling_tower: boolean;
    cooling_tower_count: number;
    total_cooling_capacity_rt: number;
    probability_level: string;
  };
}

// Agent 任务
export interface AgentTask {
  id: string;
  project_id: string;
  agent: AgentType;
  phase: SopPhase;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error: string | null;
  llm_model: string | null;
  tokens_used: number;
  duration_ms: number;
  created_at: string;
  completed_at: string | null;
}

// 项目文档
export interface ProjectDocument {
  id: string;
  project_id: string;
  phase: SopPhase;
  doc_type: string;
  title: string;
  storage_path: string | null;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}
