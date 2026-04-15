import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ProjectAuditLogItem,
  ProjectDataGapItem,
  ProjectDetail,
  ProjectEquipmentLedgerItem,
  ProjectHandoffItem,
  ProjectListFilters,
  ProjectLeadSnapshot,
  ProjectListItem,
  ProjectRepo,
  ProjectSurveyCompletionStatus,
  ProjectSurveyGateValidation,
  ProjectSurveyInfoCollection,
  ProjectSurveyRecord,
  ProjectSurveyWorkspace,
  ProjectSolutionCalculationSummary,
  ProjectSolutionCommercialBranching,
  ProjectSolutionSnapshot,
  ProjectSolutionTechnicalAssumptions,
  ProjectSolutionWorkspace,
  ProjectStageCode,
  ProjectStageGateSnapshot,
  ProjectStageItem,
  ProjectWorkflowStatus,
  UpdateProjectSolutionWorkspaceInput,
  UpdateProjectSurveyWorkspaceInput,
  UpdateProjectInput,
  UpdateProjectStageInput,
} from './project.schemas.js';
import { PROJECT_STAGE_CODES } from './project.schemas.js';
import { buildSolutionCalculationResult } from './solution-calculator.js';

type LeadRow = {
  id: string;
  enterprise_id: string | null;
  site_id: string | null;
  name: string;
  status: string;
  priority: string | null;
  lead_confirmations?: LeadConfirmationRow[] | null;
};

type LeadConfirmationRow = {
  confirmation_role: 'sales' | 'technical';
  status: 'pending' | 'confirmed' | 'rejected';
};

type ProjectStageRow = {
  stage_code: ProjectStageItem['stageCode'];
  status: ProjectStageItem['status'];
  owner_user_id: string | null;
  approver_user_id: string | null;
  entered_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  blockers: unknown[] | null;
  gate_snapshot: ProjectStageGateSnapshot | null;
};

type ProjectRow = {
  id: string;
  project_code: string | null;
  name: string;
  lead_id: string | null;
  enterprise_id: string | null;
  site_id: string | null;
  current_phase: ProjectListItem['currentPhase'] | null;
  workflow_status: ProjectListItem['workflowStatus'] | null;
  priority: string | null;
  assigned_to: string | null;
  opportunity_score: number | string | null;
  phase_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  project_stage_states?: ProjectStageRow[] | null;
};

type AuditRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  actor_source: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type EquipmentLedgerRow = {
  id: string;
  project_id: string;
  equipment_name: string;
  equipment_type: string;
  location_label: string;
  quantity: number | string | null;
  capacity_rt: number | string | null;
  status: ProjectEquipmentLedgerItem['status'];
  notes: string | null;
};

type DataGapRow = {
  id: string;
  project_id: string;
  stage_code: ProjectDataGapItem['stageCode'];
  gap_type: ProjectDataGapItem['gapType'];
  title: string;
  detail: string | null;
  status: ProjectDataGapItem['status'];
  owner_user_id: string | null;
  due_at: string | null;
  waiver_reason: string | null;
};

type HandoffRow = {
  id: string;
  project_id: string;
  from_stage: ProjectHandoffItem['fromStage'];
  to_stage: ProjectHandoffItem['toStage'];
  title: string;
  detail: string | null;
  status: ProjectHandoffItem['status'];
  owner_user_id: string | null;
  due_at: string | null;
  payload: Record<string, unknown> | null;
};

type SolutionSnapshotRow = {
  id: string;
  project_id: string;
  stage_code: ProjectStageCode;
  version_no: number | string;
  snapshot_payload: Record<string, unknown> | null;
  calculation_summary: Record<string, unknown> | null;
  gate_errors: unknown[] | null;
  created_by: string | null;
  created_at: string;
};

const PROJECT_SELECT = `
  id,
  project_code,
  name,
  lead_id,
  enterprise_id,
  site_id,
  current_phase,
  workflow_status,
  priority,
  assigned_to,
  opportunity_score,
  phase_data,
  created_at,
  updated_at,
  project_stage_states (
    stage_code,
    status,
    owner_user_id,
    approver_user_id,
    entered_at,
    due_at,
    completed_at,
    blockers,
    gate_snapshot
  )
`;

function generateProjectCode() {
  return `PROJ-${Date.now()}`;
}

function parseNumber(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getPhaseDataValue(
  phaseData: Record<string, unknown> | null | undefined,
  phaseCode: ProjectStageCode,
) {
  const value = phaseData?.[phaseCode];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getRiskSummary(row: ProjectRow) {
  const phaseCode = row.current_phase ?? 'prospecting';
  const phaseState = getPhaseDataValue(row.phase_data, phaseCode);
  return typeof phaseState.riskSummary === 'string' ? phaseState.riskSummary : '';
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getSurveyInfoCollection(
  phaseData: Record<string, unknown> | null | undefined,
): ProjectSurveyInfoCollection {
  const surveyPhase = getPhaseDataValue(phaseData, 'survey');
  const source = surveyPhase.infoCollection;
  const value = source && typeof source === 'object' && !Array.isArray(source)
    ? source as Record<string, unknown>
    : {};

  return {
    siteContactName: typeof value.siteContactName === 'string' ? value.siteContactName : '',
    siteContactPhone: typeof value.siteContactPhone === 'string' ? value.siteContactPhone : '',
    siteAccessWindow: typeof value.siteAccessWindow === 'string' ? value.siteAccessWindow : '',
    operatingSchedule: typeof value.operatingSchedule === 'string' ? value.operatingSchedule : '',
    coolingSystemType: typeof value.coolingSystemType === 'string' ? value.coolingSystemType : '',
    powerAccessStatus: typeof value.powerAccessStatus === 'string' ? value.powerAccessStatus : '',
    waterTreatmentStatus: typeof value.waterTreatmentStatus === 'string' ? value.waterTreatmentStatus : '',
    notes: typeof value.notes === 'string' ? value.notes : '',
  };
}

function getSurveyRecord(
  phaseData: Record<string, unknown> | null | undefined,
): ProjectSurveyRecord {
  const surveyPhase = getPhaseDataValue(phaseData, 'survey');
  const source = surveyPhase.surveyRecord;
  const value = source && typeof source === 'object' && !Array.isArray(source)
    ? source as Record<string, unknown>
    : {};

  return {
    surveyDate: typeof value.surveyDate === 'string' ? value.surveyDate : null,
    surveyOwnerUserId: typeof value.surveyOwnerUserId === 'string' ? value.surveyOwnerUserId : null,
    participantNames: getStringArray(value.participantNames),
    onSiteFindings: typeof value.onSiteFindings === 'string' ? value.onSiteFindings : '',
    loadProfileSummary: typeof value.loadProfileSummary === 'string' ? value.loadProfileSummary : '',
    retrofitConstraints: typeof value.retrofitConstraints === 'string' ? value.retrofitConstraints : '',
    nextActions: typeof value.nextActions === 'string' ? value.nextActions : '',
  };
}

function getSurveyCompletionStatus(
  phaseData: Record<string, unknown> | null | undefined,
): ProjectSurveyCompletionStatus {
  const surveyPhase = getPhaseDataValue(phaseData, 'survey');
  return surveyPhase.completionStatus === 'completed' ? 'completed' : 'draft';
}

function getSurveyCompletedAt(
  phaseData: Record<string, unknown> | null | undefined,
): string | null {
  const surveyPhase = getPhaseDataValue(phaseData, 'survey');
  return typeof surveyPhase.completedAt === 'string' ? surveyPhase.completedAt : null;
}

function getNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getSolutionTechnicalAssumptions(
  phaseData: Record<string, unknown> | null | undefined,
): ProjectSolutionTechnicalAssumptions {
  const proposalPhase = getPhaseDataValue(phaseData, 'proposal');
  const workspace = proposalPhase.solutionWorkspace;
  const value = workspace && typeof workspace === 'object' && !Array.isArray(workspace)
    ? workspace as Record<string, unknown>
    : {};
  const assumptions = value.technicalAssumptions;
  const source = assumptions && typeof assumptions === 'object' && !Array.isArray(assumptions)
    ? assumptions as Record<string, unknown>
    : {};

  return {
    baselineLoadRt: getNullableNumber(source.baselineLoadRt),
    targetLoadRt: getNullableNumber(source.targetLoadRt),
    operatingHoursPerYear: getNullableNumber(source.operatingHoursPerYear),
    electricityPricePerKwh: getNullableNumber(source.electricityPricePerKwh),
    baselineCop: getNullableNumber(source.baselineCop),
    targetCop: getNullableNumber(source.targetCop),
    systemLossFactor: getNullableNumber(source.systemLossFactor),
  };
}

function getDefaultSolutionCommercialBranching(): ProjectSolutionCommercialBranching {
  return {
    branchType: null,
    branchDecisionNote: '',
    freezeReady: false,
    epc: {
      capexCny: null,
      grossMarginRate: null,
      deliveryMonths: null,
    },
    emc: {
      sharedSavingRate: null,
      contractYears: null,
      guaranteedSavingRate: null,
    },
  };
}

function getSolutionCommercialBranching(
  phaseData: Record<string, unknown> | null | undefined,
): ProjectSolutionCommercialBranching {
  const proposalPhase = getPhaseDataValue(phaseData, 'proposal');
  const workspace = proposalPhase.solutionWorkspace;
  const value = workspace && typeof workspace === 'object' && !Array.isArray(workspace)
    ? workspace as Record<string, unknown>
    : {};
  const branching = value.commercialBranching;
  const source = branching && typeof branching === 'object' && !Array.isArray(branching)
    ? branching as Record<string, unknown>
    : {};

  const defaults = getDefaultSolutionCommercialBranching();

  return {
    branchType: source.branchType === 'epc' || source.branchType === 'emc'
      ? source.branchType
      : defaults.branchType,
    branchDecisionNote: typeof source.branchDecisionNote === 'string'
      ? source.branchDecisionNote
      : defaults.branchDecisionNote,
    freezeReady: typeof source.freezeReady === 'boolean'
      ? source.freezeReady
      : defaults.freezeReady,
    epc: {
      capexCny: getNullableNumber((source.epc as Record<string, unknown> | undefined)?.capexCny),
      grossMarginRate: getNullableNumber((source.epc as Record<string, unknown> | undefined)?.grossMarginRate),
      deliveryMonths: getNullableNumber((source.epc as Record<string, unknown> | undefined)?.deliveryMonths),
    },
    emc: {
      sharedSavingRate: getNullableNumber((source.emc as Record<string, unknown> | undefined)?.sharedSavingRate),
      contractYears: getNullableNumber((source.emc as Record<string, unknown> | undefined)?.contractYears),
      guaranteedSavingRate: getNullableNumber((source.emc as Record<string, unknown> | undefined)?.guaranteedSavingRate),
    },
  };
}

function normalizeSolutionAssumptions(
  assumptions: ProjectSolutionTechnicalAssumptions,
) {
  return {
    baselineLoadRt: assumptions.baselineLoadRt ?? 0,
    targetLoadRt: assumptions.targetLoadRt ?? 0,
    operatingHoursPerYear: assumptions.operatingHoursPerYear ?? 0,
    electricityPricePerKwh: assumptions.electricityPricePerKwh ?? 0,
    baselineCop: assumptions.baselineCop ?? 0,
    targetCop: assumptions.targetCop ?? 0,
    systemLossFactor: assumptions.systemLossFactor ?? 0,
  };
}

function getSolutionCalculationSummary(
  assumptions: ProjectSolutionTechnicalAssumptions,
): {
  calculationSummary: ProjectSolutionCalculationSummary;
  gateErrors: string[];
} {
  const result = buildSolutionCalculationResult(normalizeSolutionAssumptions(assumptions));
  return {
    calculationSummary: result.savingsEstimate,
    gateErrors: result.errors,
  };
}

function getSolutionCommercialGateErrors(
  branching: ProjectSolutionCommercialBranching,
): string[] {
  const errors: string[] = [];

  if (!branching.branchType) {
    errors.push('commercial branchType is required');
    return errors;
  }

  if (branching.branchType === 'epc') {
    if ((branching.epc.capexCny ?? 0) <= 0) {
      errors.push('epc.capexCny must be greater than 0');
    }
    if ((branching.epc.grossMarginRate ?? 0) <= 0) {
      errors.push('epc.grossMarginRate must be greater than 0');
    }
    if ((branching.epc.deliveryMonths ?? 0) <= 0) {
      errors.push('epc.deliveryMonths must be greater than 0');
    }
    return errors;
  }

  if ((branching.emc.sharedSavingRate ?? 0) <= 0) {
    errors.push('emc.sharedSavingRate must be greater than 0');
  }
  if ((branching.emc.contractYears ?? 0) <= 0) {
    errors.push('emc.contractYears must be greater than 0');
  }

  return errors;
}

function mapEquipmentLedgerItem(row: EquipmentLedgerRow): ProjectEquipmentLedgerItem {
  return {
    id: row.id,
    equipmentName: row.equipment_name,
    equipmentType: row.equipment_type,
    locationLabel: row.location_label,
    quantity: parseNumber(row.quantity),
    capacityRt: parseNumber(row.capacity_rt),
    status: row.status,
    notes: row.notes ?? '',
  };
}

function mapDataGapItem(row: DataGapRow): ProjectDataGapItem {
  return {
    id: row.id,
    stageCode: row.stage_code,
    gapType: row.gap_type,
    title: row.title,
    detail: row.detail ?? '',
    status: row.status,
    ownerUserId: row.owner_user_id,
    dueAt: row.due_at,
    waiverReason: row.waiver_reason ?? '',
  };
}

function mapHandoffItem(row: HandoffRow): ProjectHandoffItem {
  return {
    id: row.id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    title: row.title,
    detail: row.detail ?? '',
    status: row.status,
    ownerUserId: row.owner_user_id,
    dueAt: row.due_at,
    payload: row.payload ?? {},
  };
}

function mapSolutionSnapshot(row: SolutionSnapshotRow): ProjectSolutionSnapshot {
  const calculation = row.calculation_summary ?? {};
  const readCalculationNumber = (key: keyof ProjectSolutionCalculationSummary) => {
    const value = calculation[key];
    return typeof value === 'number' || typeof value === 'string' ? parseNumber(value) : 0;
  };
  return {
    id: row.id,
    projectId: row.project_id,
    stageCode: row.stage_code,
    versionNo: parseNumber(row.version_no),
    snapshotPayload: row.snapshot_payload ?? {},
    calculationSummary: {
      baselineAnnualEnergyKwh: readCalculationNumber('baselineAnnualEnergyKwh'),
      targetAnnualEnergyKwh: readCalculationNumber('targetAnnualEnergyKwh'),
      annualPowerSavingKwh: readCalculationNumber('annualPowerSavingKwh'),
      annualCostSavingCny: readCalculationNumber('annualCostSavingCny'),
      efficiencyImprovementRatio: readCalculationNumber('efficiencyImprovementRatio'),
      baselineCoolingPowerKw: readCalculationNumber('baselineCoolingPowerKw'),
      targetCoolingPowerKw: readCalculationNumber('targetCoolingPowerKw'),
    },
    gateErrors: getStringArray(row.gate_errors),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function buildSurveyGateValidation(
  infoCollection: ProjectSurveyInfoCollection,
  surveyRecord: ProjectSurveyRecord,
  equipmentLedger: ProjectEquipmentLedgerItem[],
  dataGaps: ProjectDataGapItem[],
  handoffs: ProjectHandoffItem[],
): ProjectSurveyGateValidation {
  const errors: string[] = [];

  if (!infoCollection.siteContactName.trim()) {
    errors.push('siteContactName is required');
  }
  if (!infoCollection.siteContactPhone.trim()) {
    errors.push('siteContactPhone is required');
  }
  if (!infoCollection.siteAccessWindow.trim()) {
    errors.push('siteAccessWindow is required');
  }
  if (!surveyRecord.surveyDate) {
    errors.push('surveyDate is required');
  }
  if (!surveyRecord.surveyOwnerUserId?.trim()) {
    errors.push('surveyOwnerUserId is required');
  }
  if (!surveyRecord.onSiteFindings.trim()) {
    errors.push('onSiteFindings is required');
  }
  if (equipmentLedger.length === 0) {
    errors.push('at least one equipment ledger item is required');
  }
  if (dataGaps.some((item) => item.gapType === 'missing_info' && item.status === 'open')) {
    errors.push('open missing_info gaps must be resolved or waived');
  }
  if (!handoffs.some((item) => item.fromStage === 'survey' && item.toStage === 'proposal' && ['ready', 'completed', 'waived'].includes(item.status))) {
    errors.push('survey to proposal handoff is required');
  }

  return {
    canComplete: errors.length === 0,
    errors,
  };
}

function mapLead(row: LeadRow): ProjectLeadSnapshot {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id ?? '',
    siteId: row.site_id ?? '',
    name: row.name,
    status: row.status,
    priority: (row.priority ?? 'medium') as ProjectLeadSnapshot['priority'],
    confirmations: (row.lead_confirmations ?? []).map((item) => ({
      role: item.confirmation_role,
      status: item.status,
    })),
  };
}

function mapStage(row: ProjectStageRow): ProjectStageItem {
  return {
    stageCode: row.stage_code,
    status: row.status,
    ownerUserId: row.owner_user_id,
    approverUserId: row.approver_user_id,
    enteredAt: row.entered_at,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    blockers: Array.isArray(row.blockers) ? row.blockers : [],
    gateSnapshot: row.gate_snapshot ?? {},
  };
}

function resolveCurrentStage(row: ProjectRow) {
  const stages = (row.project_stage_states ?? []).map(mapStage);
  const matchingStage = stages.find((item) => item.stageCode === row.current_phase);
  const inProgressStage = stages.find((item) => item.status === 'in_progress');
  const fallbackStage = stages[0];
  const currentStage = matchingStage ?? inProgressStage ?? fallbackStage;

  return {
    stages,
    currentStage,
    currentStageCode: currentStage?.stageCode ?? 'prospecting',
    currentStageStatus: currentStage?.status ?? 'not_started',
  } as const;
}

function mapProject(row: ProjectRow): ProjectDetail {
  const current = resolveCurrentStage(row);

  return {
    id: row.id,
    projectCode: row.project_code ?? '',
    name: row.name,
    leadId: row.lead_id ?? '',
    enterpriseId: row.enterprise_id ?? '',
    siteId: row.site_id ?? '',
    currentPhase: row.current_phase ?? 'prospecting',
    workflowStatus: row.workflow_status ?? 'active',
    priority: (row.priority ?? 'medium') as ProjectListItem['priority'],
    assignedTo: row.assigned_to,
    opportunityScore: parseNumber(row.opportunity_score),
    riskSummary: getRiskSummary(row),
    currentStageCode: current.currentStageCode,
    currentStageStatus: current.currentStageStatus,
    currentStageOwnerUserId: current.currentStage?.ownerUserId ?? null,
    currentStageApproverUserId: current.currentStage?.approverUserId ?? null,
    currentStageDueAt: current.currentStage?.dueAt ?? null,
    currentStageBlockersCount: current.currentStage?.blockers.length ?? 0,
    currentStagePendingHandoffsCount: getStringArray(current.currentStage?.gateSnapshot.pendingHandoffs).length,
    currentStageNextGateLabel: typeof current.currentStage?.gateSnapshot.nextGateLabel === 'string'
      ? current.currentStage.gateSnapshot.nextGateLabel
      : '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stages: current.stages,
  };
}

function mapProjectListItem(row: ProjectRow): ProjectListItem {
  const current = resolveCurrentStage(row);

  return {
    id: row.id,
    projectCode: row.project_code ?? '',
    name: row.name,
    leadId: row.lead_id ?? '',
    enterpriseId: row.enterprise_id ?? '',
    siteId: row.site_id ?? '',
    currentPhase: row.current_phase ?? 'prospecting',
    workflowStatus: row.workflow_status ?? 'active',
    priority: (row.priority ?? 'medium') as ProjectListItem['priority'],
    assignedTo: row.assigned_to,
    opportunityScore: parseNumber(row.opportunity_score),
    riskSummary: getRiskSummary(row),
    currentStageCode: current.currentStageCode,
    currentStageStatus: current.currentStageStatus,
    currentStageOwnerUserId: current.currentStage?.ownerUserId ?? null,
    currentStageApproverUserId: current.currentStage?.approverUserId ?? null,
    currentStageDueAt: current.currentStage?.dueAt ?? null,
    currentStageBlockersCount: current.currentStage?.blockers.length ?? 0,
    currentStagePendingHandoffsCount: getStringArray(current.currentStage?.gateSnapshot.pendingHandoffs).length,
    currentStageNextGateLabel: typeof current.currentStage?.gateSnapshot.nextGateLabel === 'string'
      ? current.currentStage.gateSnapshot.nextGateLabel
      : '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuditLog(row: AuditRow): ProjectAuditLogItem {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorSource: row.actor_source,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

async function insertProjectAuditLog(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  action: string,
  actorUserId: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin
    .from('workflow_audit_logs')
    .insert({
      entity_type: 'project',
      entity_id: projectId,
      action,
      actor_user_id: actorUserId || null,
      actor_source: actorUserId ? 'api' : 'anonymous',
      payload,
    });

  if (error) {
    throw error;
  }
}

async function getProjectRow(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectRow | null> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProjectRow | null;
}

async function getProjectById(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectDetail | null> {
  const data = await getProjectRow(supabaseAdmin, projectId);
  return data ? mapProject(data) : null;
}

async function getProjectByLeadIdInternal(
  supabaseAdmin: SupabaseClient,
  leadId: string,
): Promise<ProjectDetail | null> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('lead_id', leadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProject(data as ProjectRow) : null;
}

async function getEquipmentLedgerRows(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectEquipmentLedgerItem[]> {
  const { data, error } = await supabaseAdmin
    .from('project_equipment_ledger_items')
    .select('id, project_id, equipment_name, equipment_type, location_label, quantity, capacity_rt, status, notes')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapEquipmentLedgerItem(item as EquipmentLedgerRow));
}

async function getDataGapRows(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectDataGapItem[]> {
  const { data, error } = await supabaseAdmin
    .from('project_data_gaps')
    .select('id, project_id, stage_code, gap_type, title, detail, status, owner_user_id, due_at, waiver_reason')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapDataGapItem(item as DataGapRow));
}

async function getHandoffRows(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectHandoffItem[]> {
  const { data, error } = await supabaseAdmin
    .from('project_handoffs')
    .select('id, project_id, from_stage, to_stage, title, detail, status, owner_user_id, due_at, payload')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapHandoffItem(item as HandoffRow));
}

async function getProjectSurveyWorkspace(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectSurveyWorkspace | null> {
  const project = await getProjectRow(supabaseAdmin, projectId);
  if (!project) {
    return null;
  }

  const [equipmentLedger, dataGaps, handoffs] = await Promise.all([
    getEquipmentLedgerRows(supabaseAdmin, projectId),
    getDataGapRows(supabaseAdmin, projectId),
    getHandoffRows(supabaseAdmin, projectId),
  ]);

  const infoCollection = getSurveyInfoCollection(project.phase_data);
  const surveyRecord = getSurveyRecord(project.phase_data);
  const gateValidation = buildSurveyGateValidation(
    infoCollection,
    surveyRecord,
    equipmentLedger,
    dataGaps,
    handoffs,
  );

  return {
    projectId,
    infoCollection,
    surveyRecord,
    equipmentLedger,
    dataGaps,
    handoffs,
    gateValidation,
    completionStatus: getSurveyCompletionStatus(project.phase_data),
    completedAt: getSurveyCompletedAt(project.phase_data),
  };
}

async function getLatestSolutionSnapshot(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectSolutionSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from('project_solution_snapshots')
    .select('id, project_id, stage_code, version_no, snapshot_payload, calculation_summary, gate_errors, created_by, created_at')
    .eq('project_id', projectId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSolutionSnapshot(data as SolutionSnapshotRow) : null;
}

async function listProjectSolutionSnapshots(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectSolutionSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .from('project_solution_snapshots')
    .select('id, project_id, stage_code, version_no, snapshot_payload, calculation_summary, gate_errors, created_by, created_at')
    .eq('project_id', projectId)
    .order('version_no', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapSolutionSnapshot(item as SolutionSnapshotRow));
}

async function getProjectSolutionWorkspace(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectSolutionWorkspace | null> {
  const project = await getProjectRow(supabaseAdmin, projectId);
  if (!project) {
    return null;
  }

  const assumptions = getSolutionTechnicalAssumptions(project.phase_data);
  const commercialBranching = getSolutionCommercialBranching(project.phase_data);
  const { calculationSummary, gateErrors: technicalGateErrors } = getSolutionCalculationSummary(assumptions);
  const commercialGateErrors = getSolutionCommercialGateErrors(commercialBranching);
  const gateErrors = [...technicalGateErrors, ...commercialGateErrors];
  const latestSnapshot = await getLatestSolutionSnapshot(supabaseAdmin, projectId);

  return {
    projectId,
    technicalAssumptions: assumptions,
    commercialBranching,
    calculationSummary,
    gateValidation: {
      canSnapshot: gateErrors.length === 0,
      errors: gateErrors,
    },
    lastSnapshotVersion: latestSnapshot?.versionNo ?? 0,
    lastSnapshotAt: latestSnapshot?.createdAt ?? null,
  };
}

async function replaceEquipmentLedger(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  items: ProjectEquipmentLedgerItem[],
) {
  const { error: deleteError } = await supabaseAdmin
    .from('project_equipment_ledger_items')
    .delete()
    .eq('project_id', projectId);

  if (deleteError) {
    throw deleteError;
  }

  if (items.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('project_equipment_ledger_items')
    .insert(items.map((item) => ({
      id: item.id || undefined,
      project_id: projectId,
      equipment_name: item.equipmentName,
      equipment_type: item.equipmentType,
      location_label: item.locationLabel,
      quantity: item.quantity,
      capacity_rt: item.capacityRt,
      status: item.status,
      notes: item.notes,
    })));

  if (error) {
    throw error;
  }
}

async function replaceDataGaps(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  items: ProjectDataGapItem[],
) {
  const { error: deleteError } = await supabaseAdmin
    .from('project_data_gaps')
    .delete()
    .eq('project_id', projectId);

  if (deleteError) {
    throw deleteError;
  }

  if (items.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('project_data_gaps')
    .insert(items.map((item) => ({
      id: item.id || undefined,
      project_id: projectId,
      stage_code: item.stageCode,
      gap_type: item.gapType,
      title: item.title,
      detail: item.detail,
      status: item.status,
      owner_user_id: item.ownerUserId,
      due_at: item.dueAt,
      waiver_reason: item.waiverReason,
    })));

  if (error) {
    throw error;
  }
}

async function replaceHandoffs(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  items: ProjectHandoffItem[],
) {
  const { error: deleteError } = await supabaseAdmin
    .from('project_handoffs')
    .delete()
    .eq('project_id', projectId);

  if (deleteError) {
    throw deleteError;
  }

  if (items.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('project_handoffs')
    .insert(items.map((item) => ({
      id: item.id || undefined,
      project_id: projectId,
      from_stage: item.fromStage,
      to_stage: item.toStage,
      title: item.title,
      detail: item.detail,
      status: item.status,
      owner_user_id: item.ownerUserId,
      due_at: item.dueAt,
      payload: item.payload,
    })));

  if (error) {
    throw error;
  }
}

export function createProjectRepo(supabaseAdmin: SupabaseClient): ProjectRepo {
  return {
    async getLeadSnapshot(leadId) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select(`
          id,
          enterprise_id,
          site_id,
          name,
          status,
          priority,
          lead_confirmations (
            confirmation_role,
            status
          )
        `)
        .eq('id', leadId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapLead(data as LeadRow) : null;
    },

    async getProjectByLeadId(leadId) {
      return getProjectByLeadIdInternal(supabaseAdmin, leadId);
    },

    async getProjectById(projectId) {
      return getProjectById(supabaseAdmin, projectId);
    },

    async createProjectFromLead(leadId, name, actorUserId) {
      const { data: leadData, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('id, enterprise_id, site_id, priority')
        .eq('id', leadId)
        .maybeSingle();

      if (leadError) {
        throw leadError;
      }

      const lead = leadData as Pick<LeadRow, 'id' | 'enterprise_id' | 'site_id' | 'priority'> | null;
      if (!lead?.enterprise_id || !lead.site_id) {
        return null;
      }

      const existing = await getProjectByLeadIdInternal(supabaseAdmin, leadId);
      if (existing) {
        return existing;
      }

      const { data: projectData, error: projectError } = await supabaseAdmin
        .from('projects')
        .insert({
          project_code: generateProjectCode(),
          lead_id: leadId,
          enterprise_id: lead.enterprise_id,
          site_id: lead.site_id,
          name,
          current_phase: 'prospecting',
          workflow_status: 'active',
          status: 'active',
          priority: lead.priority ?? 'medium',
          assigned_to: actorUserId,
        })
        .select('id')
        .maybeSingle();

      if (projectError) {
        throw projectError;
      }

      if (!projectData?.id) {
        return null;
      }

      const stageTimestamp = new Date().toISOString();
      const { error: stageError } = await supabaseAdmin
        .from('project_stage_states')
        .upsert(
          PROJECT_STAGE_CODES.map((stageCode, index) => ({
            project_id: projectData.id,
            stage_code: stageCode,
            status: index === 0 ? 'in_progress' : 'not_started',
            entered_at: index === 0 ? stageTimestamp : null,
            blockers: [],
            gate_snapshot: {
              initializedBy: actorUserId,
            },
          })),
          {
            onConflict: 'project_id,stage_code',
            ignoreDuplicates: false,
          },
        );

      if (stageError) {
        throw stageError;
      }

      const { error: leadUpdateError } = await supabaseAdmin
        .from('leads')
        .update({
          status: 'converted',
        })
        .eq('id', leadId);

      if (leadUpdateError) {
        throw leadUpdateError;
      }

      return getProjectById(supabaseAdmin, projectData.id);
    },

    async listProjects(filters: ProjectListFilters = {}) {
      let query = supabaseAdmin
        .from('projects')
        .select(PROJECT_SELECT)
        .order('updated_at', { ascending: false });

      if (filters.phase) {
        query = query.eq('current_phase', filters.phase);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data ?? []).map((item) => mapProjectListItem(item as ProjectRow));
    },

    async updateProject(projectId, input, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.priority !== undefined) {
        updates.priority = input.priority;
      }
      if (input.workflowStatus !== undefined) {
        updates.workflow_status = input.workflowStatus;
        updates.status = input.workflowStatus === 'blocked' ? 'on_hold' : existing.workflow_status === 'blocked'
          ? 'active'
          : input.workflowStatus === 'completed' || input.workflowStatus === 'cancelled'
            ? input.workflowStatus
            : 'active';
      }
      if (input.assignedTo !== undefined) {
        updates.assigned_to = input.assignedTo;
      }
      if (input.opportunityScore !== undefined) {
        updates.opportunity_score = input.opportunityScore;
      }
      if (input.riskSummary !== undefined) {
        const phaseCode = existing.current_phase ?? 'prospecting';
        const phaseData = {
          ...(existing.phase_data ?? {}),
          [phaseCode]: {
            ...getPhaseDataValue(existing.phase_data, phaseCode),
            riskSummary: input.riskSummary,
          },
        };
        updates.phase_data = phaseData;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin
          .from('projects')
          .update(updates)
          .eq('id', projectId);

        if (error) {
          throw error;
        }

        await insertProjectAuditLog(supabaseAdmin, projectId, 'project.updated', actorUserId, {
          changes: input,
        });
      }

      return getProjectById(supabaseAdmin, projectId);
    },

    async updateProjectStage(projectId, stageCode, input, actorUserId) {
      const existingProject = await getProjectRow(supabaseAdmin, projectId);
      if (!existingProject) {
        return null;
      }

      const existingStage = (existingProject.project_stage_states ?? []).find((item) => item.stage_code === stageCode);
      const gateSnapshot: ProjectStageGateSnapshot = {
        ...(existingStage?.gate_snapshot ?? {}),
      };
      if (input.collaboratorUserIds !== undefined) {
        gateSnapshot.collaboratorUserIds = input.collaboratorUserIds;
      }
      if (input.pendingHandoffs !== undefined) {
        gateSnapshot.pendingHandoffs = input.pendingHandoffs;
      }
      if (input.nextGateLabel !== undefined) {
        gateSnapshot.nextGateLabel = input.nextGateLabel;
      }

      const timestamp = new Date().toISOString();
      const stageUpdates: Record<string, unknown> = {
        project_id: projectId,
        stage_code: stageCode,
      };
      if (input.status !== undefined) {
        stageUpdates.status = input.status;
        if (input.status === 'in_progress') {
          stageUpdates.entered_at = existingStage?.entered_at ?? timestamp;
        }
        if (input.status === 'completed') {
          stageUpdates.completed_at = timestamp;
        } else {
          stageUpdates.completed_at = null;
        }
      }
      if (input.ownerUserId !== undefined) {
        stageUpdates.owner_user_id = input.ownerUserId;
      }
      if (input.approverUserId !== undefined) {
        stageUpdates.approver_user_id = input.approverUserId;
      }
      if (input.dueAt !== undefined) {
        stageUpdates.due_at = input.dueAt;
      }
      if (input.blockers !== undefined) {
        stageUpdates.blockers = input.blockers;
      }
      if (
        input.collaboratorUserIds !== undefined
        || input.pendingHandoffs !== undefined
        || input.nextGateLabel !== undefined
      ) {
        stageUpdates.gate_snapshot = gateSnapshot;
      }

      const { error: stageError } = await supabaseAdmin
        .from('project_stage_states')
        .upsert(stageUpdates, {
          onConflict: 'project_id,stage_code',
          ignoreDuplicates: false,
        });

      if (stageError) {
        throw stageError;
      }

      if (input.status === 'in_progress') {
        const { error: projectError } = await supabaseAdmin
          .from('projects')
          .update({ current_phase: stageCode })
          .eq('id', projectId);

        if (projectError) {
          throw projectError;
        }
      }

      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.stage.updated', actorUserId, {
        stageCode,
        changes: input,
      });

      return getProjectById(supabaseAdmin, projectId);
    },

    async getProjectAudit(projectId) {
      const { data, error } = await supabaseAdmin
        .from('workflow_audit_logs')
        .select('id, entity_type, entity_id, action, actor_user_id, actor_source, payload, created_at')
        .eq('entity_type', 'project')
        .eq('entity_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((item) => mapAuditLog(item as AuditRow));
    },

    async getProjectSurveyWorkspace(projectId) {
      return getProjectSurveyWorkspace(supabaseAdmin, projectId);
    },

    async updateProjectSurveyWorkspace(projectId, input, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      if (input.infoCollection !== undefined || input.surveyRecord !== undefined) {
        const currentSurveyPhase = getPhaseDataValue(existing.phase_data, 'survey');
        const currentInfoCollection = getSurveyInfoCollection(existing.phase_data);
        const currentSurveyRecord = getSurveyRecord(existing.phase_data);
        const phaseData = {
          ...(existing.phase_data ?? {}),
          survey: {
            ...currentSurveyPhase,
            infoCollection: {
              ...currentInfoCollection,
              ...(input.infoCollection ?? {}),
            },
            surveyRecord: {
              ...currentSurveyRecord,
              ...(input.surveyRecord ?? {}),
            },
            completionStatus: getSurveyCompletionStatus(existing.phase_data),
            completedAt: getSurveyCompletedAt(existing.phase_data),
          },
        };

        const { error } = await supabaseAdmin
          .from('projects')
          .update({
            phase_data: phaseData,
          })
          .eq('id', projectId);

        if (error) {
          throw error;
        }
      }

      if (input.equipmentLedger !== undefined) {
        await replaceEquipmentLedger(supabaseAdmin, projectId, input.equipmentLedger);
      }
      if (input.dataGaps !== undefined) {
        await replaceDataGaps(supabaseAdmin, projectId, input.dataGaps);
      }
      if (input.handoffs !== undefined) {
        await replaceHandoffs(supabaseAdmin, projectId, input.handoffs);
      }

      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.survey.updated', actorUserId, {
        changes: input,
      });

      return getProjectSurveyWorkspace(supabaseAdmin, projectId);
    },

    async completeProjectSurveyWorkspace(projectId, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      const timestamp = new Date().toISOString();
      const currentSurveyPhase = getPhaseDataValue(existing.phase_data, 'survey');
      const { error: projectError } = await supabaseAdmin
        .from('projects')
        .update({
          phase_data: {
            ...(existing.phase_data ?? {}),
            survey: {
              ...currentSurveyPhase,
              infoCollection: getSurveyInfoCollection(existing.phase_data),
              surveyRecord: getSurveyRecord(existing.phase_data),
              completionStatus: 'completed',
              completedAt: timestamp,
            },
          },
        })
        .eq('id', projectId);

      if (projectError) {
        throw projectError;
      }

      const existingStage = (existing.project_stage_states ?? []).find((item) => item.stage_code === 'survey');
      const { error: stageError } = await supabaseAdmin
        .from('project_stage_states')
        .upsert({
          project_id: projectId,
          stage_code: 'survey',
          status: 'completed',
          entered_at: existingStage?.entered_at ?? timestamp,
          due_at: existingStage?.due_at ?? null,
          owner_user_id: existingStage?.owner_user_id ?? null,
          approver_user_id: existingStage?.approver_user_id ?? null,
          blockers: existingStage?.blockers ?? [],
          gate_snapshot: {
            ...(existingStage?.gate_snapshot ?? {}),
            completionStatus: 'completed',
            completedAt: timestamp,
          },
          completed_at: timestamp,
        }, {
          onConflict: 'project_id,stage_code',
          ignoreDuplicates: false,
        });

      if (stageError) {
        throw stageError;
      }

      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.survey.completed', actorUserId, {
        completedAt: timestamp,
      });

      return getProjectSurveyWorkspace(supabaseAdmin, projectId);
    },

    async getProjectSolutionWorkspace(projectId) {
      return getProjectSolutionWorkspace(supabaseAdmin, projectId);
    },

    async updateProjectSolutionWorkspace(projectId, input, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      const currentProposalPhase = getPhaseDataValue(existing.phase_data, 'proposal');
      const currentWorkspace = currentProposalPhase.solutionWorkspace
        && typeof currentProposalPhase.solutionWorkspace === 'object'
        && !Array.isArray(currentProposalPhase.solutionWorkspace)
        ? currentProposalPhase.solutionWorkspace as Record<string, unknown>
        : {};
      const currentAssumptions = getSolutionTechnicalAssumptions(existing.phase_data);
      const currentCommercialBranching = getSolutionCommercialBranching(existing.phase_data);
      const nextAssumptions = {
        ...currentAssumptions,
        ...(input.technicalAssumptions ?? {}),
      };
      const nextCommercialBranching = {
        ...currentCommercialBranching,
        ...(input.commercialBranching ?? {}),
        epc: {
          ...currentCommercialBranching.epc,
          ...(input.commercialBranching?.epc ?? {}),
        },
        emc: {
          ...currentCommercialBranching.emc,
          ...(input.commercialBranching?.emc ?? {}),
        },
      };

      const { error } = await supabaseAdmin
        .from('projects')
        .update({
          phase_data: {
            ...(existing.phase_data ?? {}),
            proposal: {
              ...currentProposalPhase,
              solutionWorkspace: {
                ...currentWorkspace,
                technicalAssumptions: nextAssumptions,
                commercialBranching: nextCommercialBranching,
              },
            },
          },
        })
        .eq('id', projectId);

      if (error) {
        throw error;
      }

      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.solution.updated', actorUserId, {
        changes: input,
      });

      return getProjectSolutionWorkspace(supabaseAdmin, projectId);
    },

    async listProjectSolutionSnapshots(projectId) {
      return listProjectSolutionSnapshots(supabaseAdmin, projectId);
    },

    async createProjectSolutionSnapshot(projectId, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      const workspace = await getProjectSolutionWorkspace(supabaseAdmin, projectId);
      if (!workspace) {
        return null;
      }

      const latestSnapshot = await getLatestSolutionSnapshot(supabaseAdmin, projectId);
      const nextVersion = (latestSnapshot?.versionNo ?? 0) + 1;
      const timestamp = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('project_solution_snapshots')
        .insert({
          project_id: projectId,
          stage_code: 'proposal',
          version_no: nextVersion,
          snapshot_payload: {
            technicalAssumptions: workspace.technicalAssumptions,
            commercialBranching: workspace.commercialBranching,
          },
          calculation_summary: workspace.calculationSummary,
          gate_errors: workspace.gateValidation.errors,
          created_by: actorUserId || null,
          created_at: timestamp,
        })
        .select('id, project_id, stage_code, version_no, snapshot_payload, calculation_summary, gate_errors, created_by, created_at')
        .single();

      if (error) {
        throw error;
      }

      const currentProposalPhase = getPhaseDataValue(existing.phase_data, 'proposal');
      const { error: projectError } = await supabaseAdmin
        .from('projects')
        .update({
          phase_data: {
            ...(existing.phase_data ?? {}),
            proposal: {
              ...currentProposalPhase,
              solutionWorkspace: {
                technicalAssumptions: workspace.technicalAssumptions,
                commercialBranching: workspace.commercialBranching,
                lastSnapshotVersion: nextVersion,
                lastSnapshotAt: timestamp,
              },
            },
          },
        })
        .eq('id', projectId);

      if (projectError) {
        throw projectError;
      }

      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.solution.snapshotted', actorUserId, {
        versionNo: nextVersion,
        createdAt: timestamp,
      });

      return mapSolutionSnapshot(data as SolutionSnapshotRow);
    },
  };
}
