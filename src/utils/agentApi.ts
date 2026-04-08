const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:8001';

export type AgentType =
  | 'pre_sales_qualification'
  | 'solution_generation'
  | 'bid_contract'
  | 'project_execution'
  | 'training_acceptance'
  | 'smart_om';

export interface AgentRunResult {
  task_id: string;
  agent: string;
  status: 'completed' | 'failed' | 'running';
  output?: Record<string, unknown>;
  error?: string;
}

export interface QualificationScore {
  total_score: number;
  priority: 'high' | 'medium' | 'low';
  breakdown: {
    cooling_tower: number;
    cooling_capacity: number;
    industry_match: number;
    data_completeness: number;
  };
  industry_weight: number;
}

export interface QualificationOutput {
  score: QualificationScore;
  profile: string;
  qualified_at: string;
}

export async function runAgent(
  agentType: AgentType,
  projectId: string,
  inputData: Record<string, unknown> = {},
): Promise<AgentRunResult> {
  const res = await fetch(`${ORCHESTRATOR_URL}/agents/${agentType}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      input_data: inputData,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Agent error: ${res.status}`);
  }

  return res.json();
}

export async function listAgents(): Promise<Record<string, { name: string; description: string; status: string }>> {
  const res = await fetch(`${ORCHESTRATOR_URL}/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function runQualification(
  projectId: string,
  enterprise: Record<string, unknown>,
): Promise<QualificationOutput> {
  const result = await runAgent('pre_sales_qualification', projectId, { enterprise });
  if (result.status === 'failed') {
    throw new Error(result.error || 'Qualification failed');
  }
  return result.output as unknown as QualificationOutput;
}
