import type { SopPhase } from '../types/project';
import { apiRequest } from './client';
import type {
  DataGapItem,
  EquipmentLedgerItem,
  HandoffItem,
  ProjectSurveyWorkspace,
  ProjectSurveyWorkspacePayload,
  SurveyCompletionStatus,
  SurveyGateValidation,
  SurveyInfoCollection,
  SurveyRecordData,
} from '../utils/projectSurveyWorkspace';
import type {
  ProjectCommercialBranchType,
  ProjectSolutionCommercialBranching,
  ProjectSolutionEpcCommercial,
  ProjectSolutionEmcCommercial,
  ProjectSolutionSnapshot,
  ProjectSolutionWorkspace,
  ProjectSolutionWorkspacePayload,
  ProjectSolutionCalculationSummary,
  ProjectSolutionGateValidation,
  ProjectSolutionTechnicalAssumptions,
} from '../utils/projectSolutionWorkspace';

export type ProjectPriority = 'high' | 'medium' | 'low';
export type ProjectWorkflowStatus = 'active' | 'blocked' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectStageStatus = 'not_started' | 'in_progress' | 'blocked' | 'pending_approval' | 'completed' | 'waived';

export interface ProjectStageDraftInput {
  status?: ProjectStageStatus;
  ownerUserId?: string | null;
  approverUserId?: string | null;
  dueAt?: string | null;
  blockers?: string[];
  collaboratorUserIds?: string[];
  pendingHandoffs?: string[];
  nextGateLabel?: string;
}

export interface ProjectUpdateInput {
  name?: string;
  priority?: ProjectPriority;
  workflowStatus?: ProjectWorkflowStatus;
  assignedTo?: string | null;
  opportunityScore?: number;
  riskSummary?: string;
}

export interface ProjectStageData {
  stageCode: SopPhase;
  status: ProjectStageStatus;
  ownerUserId: string | null;
  approverUserId: string | null;
  enteredAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  blockers: string[];
  collaboratorUserIds: string[];
  pendingHandoffs: string[];
  nextGateLabel: string;
  gateSnapshot: Record<string, unknown>;
}

export interface ProjectAuditItem {
  id: string;
  action: string;
  actorUserId: string | null;
  actorSource: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type {
  DataGapItem,
  EquipmentLedgerItem,
  HandoffItem,
  ProjectSolutionCalculationSummary,
  ProjectSolutionGateValidation,
  ProjectSolutionSnapshot,
  ProjectSolutionTechnicalAssumptions,
  ProjectSolutionWorkspace,
  ProjectSolutionWorkspacePayload,
  ProjectSurveyWorkspace,
  ProjectSurveyWorkspacePayload,
  SurveyCompletionStatus,
  SurveyInfoCollection,
  SurveyRecordData,
};

export interface ProjectListItem {
  id: string;
  projectCode: string;
  name: string;
  leadId: string;
  enterpriseId: string;
  siteId: string;
  currentPhase: SopPhase;
  workflowStatus: ProjectWorkflowStatus;
  priority: ProjectPriority;
  assignedTo: string | null;
  opportunityScore: number;
  riskSummary: string;
  currentStageCode: SopPhase;
  currentStageStatus: ProjectStageStatus;
  currentStageDueAt: string | null;
  currentStageOwnerUserId: string | null;
  currentStageApproverUserId: string | null;
  currentStageBlockers: string[];
  currentStageBlockersCount: number;
  currentStagePendingHandoffs: string[];
  currentStagePendingHandoffsCount: number;
  currentStageNextGateLabel: string;
  commercialBranchType: ProjectCommercialBranchType | null;
  commercialFreezeReady: boolean;
  solutionCanSnapshot: boolean;
  solutionGateErrorCount: number;
  lastSolutionSnapshotVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailData {
  id: string;
  project_code: string;
  name: string;
  lead_id: string;
  enterprise_id: string;
  site_id: string;
  current_phase: SopPhase;
  status: ProjectWorkflowStatus;
  priority: ProjectPriority;
  assigned_to: string | null;
  opportunity_score: number;
  risk_summary: string;
  current_stage_code: SopPhase;
  current_stage_status: ProjectStageStatus;
  created_at: string;
  updated_at: string;
  stages: ProjectStageData[];
}

type RawStage = {
  stageCode?: SopPhase;
  stage_code?: SopPhase;
  status?: ProjectStageStatus;
  ownerUserId?: string | null;
  owner_user_id?: string | null;
  approverUserId?: string | null;
  approver_user_id?: string | null;
  enteredAt?: string | null;
  entered_at?: string | null;
  dueAt?: string | null;
  due_at?: string | null;
  completedAt?: string | null;
  completed_at?: string | null;
  blockers?: unknown[];
  collaboratorUserIds?: unknown[];
  pendingHandoffs?: unknown[];
  nextGateLabel?: string | null;
  gateSnapshot?: Record<string, unknown>;
  gate_snapshot?: Record<string, unknown>;
};

type RawProjectItem = {
  id: string;
  projectCode?: string;
  project_code?: string;
  name: string;
  leadId?: string;
  lead_id?: string;
  enterpriseId?: string;
  enterprise_id?: string;
  siteId?: string;
  site_id?: string;
  currentPhase?: SopPhase;
  current_phase?: SopPhase;
  workflowStatus?: ProjectWorkflowStatus;
  workflow_status?: ProjectWorkflowStatus;
  status?: ProjectWorkflowStatus;
  priority?: ProjectPriority;
  assignedTo?: string | null;
  assigned_to?: string | null;
  opportunityScore?: number;
  opportunity_score?: number;
  riskSummary?: string;
  risk_summary?: string;
  currentStageCode?: SopPhase;
  current_stage_code?: SopPhase;
  currentStageStatus?: ProjectStageStatus;
  current_stage_status?: ProjectStageStatus;
  currentStageDueAt?: string | null;
  current_stage_due_at?: string | null;
  currentStageOwnerUserId?: string | null;
  current_stage_owner_user_id?: string | null;
  currentStageApproverUserId?: string | null;
  current_stage_approver_user_id?: string | null;
  currentStageBlockers?: unknown[];
  current_stage_blockers?: unknown[];
  currentStageBlockersCount?: number;
  current_stage_blockers_count?: number;
  currentStagePendingHandoffs?: unknown[];
  current_stage_pending_handoffs?: unknown[];
  currentStagePendingHandoffsCount?: number;
  current_stage_pending_handoffs_count?: number;
  currentStageNextGateLabel?: string | null;
  current_stage_next_gate_label?: string | null;
  commercialBranchType?: ProjectCommercialBranchType | null;
  commercial_branch_type?: ProjectCommercialBranchType | null;
  commercialFreezeReady?: boolean;
  commercial_freeze_ready?: boolean;
  solutionCanSnapshot?: boolean;
  solution_can_snapshot?: boolean;
  solutionGateErrorCount?: number;
  solution_gate_error_count?: number;
  lastSolutionSnapshotVersion?: number | string;
  last_solution_snapshot_version?: number | string;
  currentStage?: RawStage;
  current_stage?: RawStage;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  stages?: RawStage[];
};

type RawAuditItem = {
  id: string;
  action: string;
  actorUserId?: string | null;
  actor_user_id?: string | null;
  actorSource?: string;
  actor_source?: string;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
  created_at?: string;
};

type RawSurveyWorkspace = {
  projectId?: string;
  project_id?: string;
  infoCollection?: Partial<SurveyInfoCollection>;
  info_collection?: Partial<SurveyInfoCollection>;
  surveyRecord?: Partial<SurveyRecordData>;
  survey_record?: Partial<SurveyRecordData>;
  equipmentLedger?: RawEquipmentLedgerItem[];
  equipment_ledger?: RawEquipmentLedgerItem[];
  dataGaps?: RawDataGapItem[];
  data_gaps?: RawDataGapItem[];
  handoffs?: RawHandoffItem[];
  gateValidation?: Partial<SurveyGateValidation>;
  gate_validation?: Partial<SurveyGateValidation>;
  completionStatus?: SurveyCompletionStatus;
  completion_status?: SurveyCompletionStatus;
  completedAt?: string | null;
  completed_at?: string | null;
};

type RawSolutionTechnicalAssumptions = {
  baselineLoadRt?: number | string | null;
  baseline_load_rt?: number | string | null;
  targetLoadRt?: number | string | null;
  target_load_rt?: number | string | null;
  operatingHoursPerYear?: number | string | null;
  operating_hours_per_year?: number | string | null;
  electricityPricePerKwh?: number | string | null;
  electricity_price_per_kwh?: number | string | null;
  baselineCop?: number | string | null;
  baseline_cop?: number | string | null;
  targetCop?: number | string | null;
  target_cop?: number | string | null;
  systemLossFactor?: number | string | null;
  system_loss_factor?: number | string | null;
};

type RawSolutionCalculationSummary = {
  baselineAnnualEnergyKwh?: number | string;
  baseline_annual_energy_kwh?: number | string;
  targetAnnualEnergyKwh?: number | string;
  target_annual_energy_kwh?: number | string;
  annualPowerSavingKwh?: number | string;
  annual_power_saving_kwh?: number | string;
  annualCostSavingCny?: number | string;
  annual_cost_saving_cny?: number | string;
  efficiencyImprovementRatio?: number | string;
  efficiency_improvement_ratio?: number | string;
  baselineCoolingPowerKw?: number | string;
  baseline_cooling_power_kw?: number | string;
  targetCoolingPowerKw?: number | string;
  target_cooling_power_kw?: number | string;
};

type RawSolutionGateValidation = {
  canSnapshot?: boolean;
  can_snapshot?: boolean;
  errors?: unknown[];
};

type RawSolutionEpcCommercial = {
  capexCny?: number | string | null;
  capex_cny?: number | string | null;
  grossMarginRate?: number | string | null;
  gross_margin_rate?: number | string | null;
  deliveryMonths?: number | string | null;
  delivery_months?: number | string | null;
};

type RawSolutionEmcCommercial = {
  sharedSavingRate?: number | string | null;
  shared_saving_rate?: number | string | null;
  contractYears?: number | string | null;
  contract_years?: number | string | null;
  guaranteedSavingRate?: number | string | null;
  guaranteed_saving_rate?: number | string | null;
};

type RawSolutionCommercialBranching = {
  branchType?: ProjectCommercialBranchType | null;
  branch_type?: ProjectCommercialBranchType | null;
  branchDecisionNote?: string;
  branch_decision_note?: string;
  freezeReady?: boolean;
  freeze_ready?: boolean;
  epc?: RawSolutionEpcCommercial;
  emc?: RawSolutionEmcCommercial;
};

type RawSolutionWorkspace = {
  projectId?: string;
  project_id?: string;
  technicalAssumptions?: RawSolutionTechnicalAssumptions;
  technical_assumptions?: RawSolutionTechnicalAssumptions;
  commercialBranching?: RawSolutionCommercialBranching;
  commercial_branching?: RawSolutionCommercialBranching;
  calculationSummary?: RawSolutionCalculationSummary;
  calculation_summary?: RawSolutionCalculationSummary;
  gateValidation?: RawSolutionGateValidation;
  gate_validation?: RawSolutionGateValidation;
  lastSnapshotVersion?: number | string;
  last_snapshot_version?: number | string;
  lastSnapshotAt?: string | null;
  last_snapshot_at?: string | null;
};

type RawSolutionSnapshot = {
  id: string;
  projectId?: string;
  project_id?: string;
  stageCode?: SopPhase;
  stage_code?: SopPhase;
  versionNo?: number | string;
  version_no?: number | string;
  snapshotPayload?: Record<string, unknown>;
  snapshot_payload?: Record<string, unknown>;
  calculationSummary?: RawSolutionCalculationSummary;
  calculation_summary?: RawSolutionCalculationSummary;
  gateErrors?: unknown[];
  gate_errors?: unknown[];
  createdBy?: string | null;
  created_by?: string | null;
  createdAt?: string;
  created_at?: string;
};

type RawEquipmentLedgerItem = {
  id?: string;
  equipmentName?: string;
  equipment_name?: string;
  equipmentType?: string;
  equipment_type?: string;
  locationLabel?: string;
  location_label?: string;
  quantity?: number | string;
  capacityRt?: number | string;
  capacity_rt?: number | string;
  status?: EquipmentLedgerItem['status'];
  notes?: string;
};

type RawDataGapItem = {
  id?: string;
  stageCode?: SopPhase;
  stage_code?: SopPhase;
  gapType?: DataGapItem['gapType'];
  gap_type?: DataGapItem['gapType'];
  title?: string;
  detail?: string;
  status?: DataGapItem['status'];
  ownerUserId?: string | null;
  owner_user_id?: string | null;
  dueAt?: string | null;
  due_at?: string | null;
  waiverReason?: string;
  waiver_reason?: string;
};

type RawHandoffItem = {
  id?: string;
  fromStage?: SopPhase;
  from_stage?: SopPhase;
  toStage?: SopPhase;
  to_stage?: SopPhase;
  title?: string;
  detail?: string;
  status?: HandoffItem['status'];
  ownerUserId?: string | null;
  owner_user_id?: string | null;
  dueAt?: string | null;
  due_at?: string | null;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }

      if (item && typeof item === 'object') {
        const label = 'label' in item
          ? item.label
          : ('name' in item
            ? item.name
            : ('title' in item ? item.title : null));
        if (typeof label === 'string') {
          return label.trim();
        }
      }

      return '';
    })
    .filter(Boolean);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function mapStage(raw: RawStage): ProjectStageData {
  const gateSnapshot = raw.gateSnapshot ?? raw.gate_snapshot ?? {};
  const collaboratorUserIds = toStringArray(
    raw.collaboratorUserIds ?? gateSnapshot.collaboratorUserIds,
  );
  const pendingHandoffs = toStringArray(
    raw.pendingHandoffs ?? gateSnapshot.pendingHandoffs,
  );
  const blockers = toStringArray(raw.blockers ?? gateSnapshot.blockers);
  const nextGateLabel = toOptionalString(
    raw.nextGateLabel ??
    raw.gateSnapshot?.nextGateLabel ??
    raw.gate_snapshot?.nextGateLabel,
  );

  return {
    stageCode: raw.stageCode ?? raw.stage_code ?? 'prospecting',
    status: raw.status ?? 'not_started',
    ownerUserId: raw.ownerUserId ?? raw.owner_user_id ?? null,
    approverUserId: raw.approverUserId ?? raw.approver_user_id ?? null,
    enteredAt: raw.enteredAt ?? raw.entered_at ?? null,
    dueAt: raw.dueAt ?? raw.due_at ?? null,
    completedAt: raw.completedAt ?? raw.completed_at ?? null,
    blockers,
    collaboratorUserIds,
    pendingHandoffs,
    nextGateLabel,
    gateSnapshot,
  };
}

function mapProjectListItem(raw: RawProjectItem): ProjectListItem {
  const currentStage = raw.currentStage ?? raw.current_stage;
  const initialBlockers = toStringArray(
    raw.currentStageBlockers ?? raw.current_stage_blockers ?? currentStage?.blockers,
  );
  const initialPendingHandoffs = toStringArray(
    raw.currentStagePendingHandoffs ??
      raw.current_stage_pending_handoffs ??
      currentStage?.pendingHandoffs ??
      currentStage?.gateSnapshot?.pendingHandoffs ??
      currentStage?.gate_snapshot?.pendingHandoffs,
  );
  const currentStageBlockersCount = toNumber(
    raw.currentStageBlockersCount ?? raw.current_stage_blockers_count,
  ) || initialBlockers.length;
  const currentStagePendingHandoffsCount = toNumber(
    raw.currentStagePendingHandoffsCount ?? raw.current_stage_pending_handoffs_count,
  ) || initialPendingHandoffs.length;
  const currentStageBlockers = initialBlockers.length > 0
    ? initialBlockers
    : Array.from({ length: currentStageBlockersCount }, () => '待补充阻塞项');
  const currentStagePendingHandoffs = initialPendingHandoffs.length > 0
    ? initialPendingHandoffs
    : Array.from({ length: currentStagePendingHandoffsCount }, () => '待补充交接项');

  return {
    id: raw.id,
    projectCode: raw.projectCode ?? raw.project_code ?? '',
    name: raw.name,
    leadId: raw.leadId ?? raw.lead_id ?? '',
    enterpriseId: raw.enterpriseId ?? raw.enterprise_id ?? '',
    siteId: raw.siteId ?? raw.site_id ?? '',
    currentPhase: raw.currentPhase ?? raw.current_phase ?? 'prospecting',
    workflowStatus: raw.workflowStatus ?? raw.workflow_status ?? raw.status ?? 'active',
    priority: raw.priority ?? 'medium',
    assignedTo: raw.assignedTo ?? raw.assigned_to ?? null,
    opportunityScore: toNumber(raw.opportunityScore ?? raw.opportunity_score),
    riskSummary: raw.riskSummary ?? raw.risk_summary ?? '',
    currentStageCode: raw.currentStageCode ?? raw.current_stage_code ?? currentStage?.stageCode ?? currentStage?.stage_code ?? 'prospecting',
    currentStageStatus: raw.currentStageStatus ?? raw.current_stage_status ?? currentStage?.status ?? 'not_started',
    currentStageDueAt: raw.currentStageDueAt ?? raw.current_stage_due_at ?? currentStage?.dueAt ?? currentStage?.due_at ?? null,
    currentStageOwnerUserId: raw.currentStageOwnerUserId ?? raw.current_stage_owner_user_id ?? currentStage?.ownerUserId ?? currentStage?.owner_user_id ?? null,
    currentStageApproverUserId: raw.currentStageApproverUserId ?? raw.current_stage_approver_user_id ?? currentStage?.approverUserId ?? currentStage?.approver_user_id ?? null,
    currentStageBlockers,
    currentStageBlockersCount,
    currentStagePendingHandoffs,
    currentStagePendingHandoffsCount,
    currentStageNextGateLabel: toOptionalString(
      raw.currentStageNextGateLabel ??
      raw.current_stage_next_gate_label ??
      currentStage?.nextGateLabel ??
      currentStage?.gateSnapshot?.nextGateLabel ??
      currentStage?.gate_snapshot?.nextGateLabel,
    ),
    commercialBranchType: (raw.commercialBranchType ?? raw.commercial_branch_type ?? null) as ProjectCommercialBranchType | null,
    commercialFreezeReady: Boolean(raw.commercialFreezeReady ?? raw.commercial_freeze_ready),
    solutionCanSnapshot: Boolean(raw.solutionCanSnapshot ?? raw.solution_can_snapshot),
    solutionGateErrorCount: toNumber(raw.solutionGateErrorCount ?? raw.solution_gate_error_count),
    lastSolutionSnapshotVersion: toNumber(
      raw.lastSolutionSnapshotVersion ?? raw.last_solution_snapshot_version,
    ),
    createdAt: raw.createdAt ?? raw.created_at ?? '',
    updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
  };
}

function mapProjectDetail(raw: RawProjectItem): ProjectDetailData {
  return {
    id: raw.id,
    project_code: raw.projectCode ?? raw.project_code ?? '',
    name: raw.name,
    lead_id: raw.leadId ?? raw.lead_id ?? '',
    enterprise_id: raw.enterpriseId ?? raw.enterprise_id ?? '',
    site_id: raw.siteId ?? raw.site_id ?? '',
    current_phase: raw.currentPhase ?? raw.current_phase ?? 'prospecting',
    status: raw.workflowStatus ?? raw.workflow_status ?? raw.status ?? 'active',
    priority: raw.priority ?? 'medium',
    assigned_to: raw.assignedTo ?? raw.assigned_to ?? null,
    opportunity_score: toNumber(raw.opportunityScore ?? raw.opportunity_score),
    risk_summary: raw.riskSummary ?? raw.risk_summary ?? '',
    current_stage_code: raw.currentStageCode ?? raw.current_stage_code ?? 'prospecting',
    current_stage_status: raw.currentStageStatus ?? raw.current_stage_status ?? 'not_started',
    created_at: raw.createdAt ?? raw.created_at ?? '',
    updated_at: raw.updatedAt ?? raw.updated_at ?? '',
    stages: Array.isArray(raw.stages) ? raw.stages.map(mapStage) : [],
  };
}

function mapAuditItem(raw: RawAuditItem): ProjectAuditItem {
  return {
    id: raw.id,
    action: raw.action,
    actorUserId: raw.actorUserId ?? raw.actor_user_id ?? null,
    actorSource: raw.actorSource ?? raw.actor_source ?? 'api',
    payload: raw.payload ?? {},
    createdAt: raw.createdAt ?? raw.created_at ?? '',
  };
}

function mapInfoCollection(raw: Partial<SurveyInfoCollection> | undefined): SurveyInfoCollection {
  return {
    siteContactName: toOptionalString(raw?.siteContactName),
    siteContactPhone: toOptionalString(raw?.siteContactPhone),
    siteAccessWindow: toOptionalString(raw?.siteAccessWindow),
    operatingSchedule: toOptionalString(raw?.operatingSchedule),
    coolingSystemType: toOptionalString(raw?.coolingSystemType),
    powerAccessStatus: toOptionalString(raw?.powerAccessStatus),
    waterTreatmentStatus: toOptionalString(raw?.waterTreatmentStatus),
    notes: toOptionalString(raw?.notes),
  };
}

function mapSurveyRecord(raw: Partial<SurveyRecordData> | undefined): SurveyRecordData {
  return {
    surveyDate: typeof raw?.surveyDate === 'string' && raw.surveyDate ? raw.surveyDate : null,
    surveyOwnerUserId: typeof raw?.surveyOwnerUserId === 'string' && raw.surveyOwnerUserId ? raw.surveyOwnerUserId : null,
    participantNames: toStringArray(raw?.participantNames),
    onSiteFindings: toOptionalString(raw?.onSiteFindings),
    loadProfileSummary: toOptionalString(raw?.loadProfileSummary),
    retrofitConstraints: toOptionalString(raw?.retrofitConstraints),
    nextActions: toOptionalString(raw?.nextActions),
  };
}

function mapEquipmentLedgerItem(raw: RawEquipmentLedgerItem): EquipmentLedgerItem {
  return {
    id: raw.id,
    equipmentName: toOptionalString(raw.equipmentName ?? raw.equipment_name),
    equipmentType: toOptionalString(raw.equipmentType ?? raw.equipment_type),
    locationLabel: toOptionalString(raw.locationLabel ?? raw.location_label),
    quantity: toNumber(raw.quantity),
    capacityRt: toNumber(raw.capacityRt ?? raw.capacity_rt),
    status: raw.status ?? 'unknown',
    notes: toOptionalString(raw.notes),
  };
}

function mapDataGapItem(raw: RawDataGapItem): DataGapItem {
  return {
    id: raw.id,
    stageCode: raw.stageCode ?? raw.stage_code ?? 'survey',
    gapType: raw.gapType ?? raw.gap_type ?? 'missing_info',
    title: toOptionalString(raw.title),
    detail: toOptionalString(raw.detail),
    status: raw.status ?? 'open',
    ownerUserId: (raw.ownerUserId ?? raw.owner_user_id) || null,
    dueAt: (raw.dueAt ?? raw.due_at) || null,
    waiverReason: toOptionalString(raw.waiverReason ?? raw.waiver_reason),
  };
}

function mapHandoffItem(raw: RawHandoffItem): HandoffItem {
  return {
    id: raw.id,
    fromStage: raw.fromStage ?? raw.from_stage ?? 'survey',
    toStage: raw.toStage ?? raw.to_stage ?? 'proposal',
    title: toOptionalString(raw.title),
    detail: toOptionalString(raw.detail),
    status: raw.status ?? 'pending',
    ownerUserId: (raw.ownerUserId ?? raw.owner_user_id) || null,
    dueAt: (raw.dueAt ?? raw.due_at) || null,
  };
}

function mapSurveyWorkspace(raw: RawSurveyWorkspace): ProjectSurveyWorkspace {
  return {
    projectId: raw.projectId ?? raw.project_id ?? '',
    infoCollection: mapInfoCollection(raw.infoCollection ?? raw.info_collection),
    surveyRecord: mapSurveyRecord(raw.surveyRecord ?? raw.survey_record),
    equipmentLedger: (raw.equipmentLedger ?? raw.equipment_ledger ?? []).map(mapEquipmentLedgerItem),
    dataGaps: (raw.dataGaps ?? raw.data_gaps ?? []).map(mapDataGapItem),
    handoffs: (raw.handoffs ?? []).map(mapHandoffItem),
    gateValidation: {
      canComplete: Boolean((raw.gateValidation ?? raw.gate_validation)?.canComplete),
      errors: toStringArray((raw.gateValidation ?? raw.gate_validation)?.errors),
    },
    completionStatus: raw.completionStatus ?? raw.completion_status ?? 'draft',
    completedAt: raw.completedAt ?? raw.completed_at ?? null,
  };
}

function mapSolutionTechnicalAssumptions(
  raw: RawSolutionTechnicalAssumptions | undefined,
): ProjectSolutionTechnicalAssumptions {
  return {
    baselineLoadRt: raw?.baselineLoadRt !== undefined || raw?.baseline_load_rt !== undefined
      ? toNumber(raw?.baselineLoadRt ?? raw?.baseline_load_rt)
      : null,
    targetLoadRt: raw?.targetLoadRt !== undefined || raw?.target_load_rt !== undefined
      ? toNumber(raw?.targetLoadRt ?? raw?.target_load_rt)
      : null,
    operatingHoursPerYear: raw?.operatingHoursPerYear !== undefined || raw?.operating_hours_per_year !== undefined
      ? toNumber(raw?.operatingHoursPerYear ?? raw?.operating_hours_per_year)
      : null,
    electricityPricePerKwh: raw?.electricityPricePerKwh !== undefined || raw?.electricity_price_per_kwh !== undefined
      ? toNumber(raw?.electricityPricePerKwh ?? raw?.electricity_price_per_kwh)
      : null,
    baselineCop: raw?.baselineCop !== undefined || raw?.baseline_cop !== undefined
      ? toNumber(raw?.baselineCop ?? raw?.baseline_cop)
      : null,
    targetCop: raw?.targetCop !== undefined || raw?.target_cop !== undefined
      ? toNumber(raw?.targetCop ?? raw?.target_cop)
      : null,
    systemLossFactor: raw?.systemLossFactor !== undefined || raw?.system_loss_factor !== undefined
      ? toNumber(raw?.systemLossFactor ?? raw?.system_loss_factor)
      : null,
  };
}

function mapSolutionCalculationSummary(
  raw: RawSolutionCalculationSummary | undefined,
): ProjectSolutionCalculationSummary {
  return {
    baselineAnnualEnergyKwh: toNumber(raw?.baselineAnnualEnergyKwh ?? raw?.baseline_annual_energy_kwh),
    targetAnnualEnergyKwh: toNumber(raw?.targetAnnualEnergyKwh ?? raw?.target_annual_energy_kwh),
    annualPowerSavingKwh: toNumber(raw?.annualPowerSavingKwh ?? raw?.annual_power_saving_kwh),
    annualCostSavingCny: toNumber(raw?.annualCostSavingCny ?? raw?.annual_cost_saving_cny),
    efficiencyImprovementRatio: toNumber(raw?.efficiencyImprovementRatio ?? raw?.efficiency_improvement_ratio),
    baselineCoolingPowerKw: toNumber(raw?.baselineCoolingPowerKw ?? raw?.baseline_cooling_power_kw),
    targetCoolingPowerKw: toNumber(raw?.targetCoolingPowerKw ?? raw?.target_cooling_power_kw),
  };
}

function mapSolutionEpcCommercial(raw: RawSolutionEpcCommercial | undefined): ProjectSolutionEpcCommercial {
  return {
    capexCny: toNullableNumber(raw?.capexCny ?? raw?.capex_cny),
    grossMarginRate: toNullableNumber(raw?.grossMarginRate ?? raw?.gross_margin_rate),
    deliveryMonths: toNullableNumber(raw?.deliveryMonths ?? raw?.delivery_months),
  };
}

function mapSolutionEmcCommercial(raw: RawSolutionEmcCommercial | undefined): ProjectSolutionEmcCommercial {
  return {
    sharedSavingRate: toNullableNumber(raw?.sharedSavingRate ?? raw?.shared_saving_rate),
    contractYears: toNullableNumber(raw?.contractYears ?? raw?.contract_years),
    guaranteedSavingRate: toNullableNumber(raw?.guaranteedSavingRate ?? raw?.guaranteed_saving_rate),
  };
}

function mapSolutionCommercialBranching(
  raw: RawSolutionCommercialBranching | undefined,
): ProjectSolutionCommercialBranching {
  return {
    branchType: (raw?.branchType ?? raw?.branch_type ?? null) as ProjectCommercialBranchType | null,
    branchDecisionNote: raw?.branchDecisionNote ?? raw?.branch_decision_note ?? '',
    freezeReady: Boolean(raw?.freezeReady ?? raw?.freeze_ready),
    epc: mapSolutionEpcCommercial(raw?.epc),
    emc: mapSolutionEmcCommercial(raw?.emc),
  };
}

function mapSolutionWorkspace(raw: RawSolutionWorkspace): ProjectSolutionWorkspace {
  return {
    projectId: raw.projectId ?? raw.project_id ?? '',
    technicalAssumptions: mapSolutionTechnicalAssumptions(raw.technicalAssumptions ?? raw.technical_assumptions),
    commercialBranching: mapSolutionCommercialBranching(raw.commercialBranching ?? raw.commercial_branching),
    calculationSummary: mapSolutionCalculationSummary(raw.calculationSummary ?? raw.calculation_summary),
    gateValidation: {
      canSnapshot: Boolean((raw.gateValidation ?? raw.gate_validation)?.canSnapshot ?? (raw.gateValidation ?? raw.gate_validation)?.can_snapshot),
      errors: toStringArray((raw.gateValidation ?? raw.gate_validation)?.errors),
    },
    lastSnapshotVersion: toNumber(raw.lastSnapshotVersion ?? raw.last_snapshot_version),
    lastSnapshotAt: raw.lastSnapshotAt ?? raw.last_snapshot_at ?? null,
  };
}

function mapSolutionSnapshot(raw: RawSolutionSnapshot): ProjectSolutionSnapshot {
  return {
    id: raw.id,
    projectId: raw.projectId ?? raw.project_id ?? '',
    stageCode: raw.stageCode ?? raw.stage_code ?? 'proposal',
    versionNo: toNumber(raw.versionNo ?? raw.version_no),
    snapshotPayload: raw.snapshotPayload ?? raw.snapshot_payload ?? {},
    calculationSummary: mapSolutionCalculationSummary(raw.calculationSummary ?? raw.calculation_summary),
    gateErrors: toStringArray(raw.gateErrors ?? raw.gate_errors),
    createdBy: raw.createdBy ?? raw.created_by ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? '',
  };
}

export async function listProjects(phase?: SopPhase | '') {
  const params = new URLSearchParams();
  if (phase) {
    params.set('phase', phase);
  }

  const path = params.toString() ? `/v1/projects?${params.toString()}` : '/v1/projects';
  const response = await apiRequest<{ items: RawProjectItem[] }>(path);
  return response.items.map(mapProjectListItem);
}

export async function createProject(input: { leadId: string; name?: string }) {
  const response = await apiRequest<{ item: RawProjectItem }>('/v1/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return mapProjectListItem(response.item);
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetailData> {
  const response = await apiRequest<{ item: RawProjectItem }>(`/v1/projects/${projectId}`);
  return mapProjectDetail(response.item);
}

export async function updateProject(projectId: string, input: ProjectUpdateInput): Promise<ProjectDetailData> {
  const response = await apiRequest<{ item: RawProjectItem }>(`/v1/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  return mapProjectDetail(response.item);
}

export async function updateProjectStage(
  projectId: string,
  stageCode: SopPhase,
  input: ProjectStageDraftInput,
): Promise<ProjectDetailData> {
  const response = await apiRequest<{ item: RawProjectItem }>(
    `/v1/projects/${projectId}/stages/${stageCode}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );

  return mapProjectDetail(response.item);
}

export async function getProjectAudit(projectId: string): Promise<ProjectAuditItem[]> {
  const response = await apiRequest<{ items: RawAuditItem[] }>(`/v1/projects/${projectId}/audit`);
  return response.items.map(mapAuditItem);
}

export async function getProjectSurveyWorkspace(projectId: string): Promise<ProjectSurveyWorkspace> {
  const response = await apiRequest<{ item: RawSurveyWorkspace }>(
    `/v1/projects/${projectId}/survey-workspace`,
  );
  return mapSurveyWorkspace(response.item);
}

export async function updateProjectSurveyWorkspace(
  projectId: string,
  input: ProjectSurveyWorkspacePayload,
): Promise<ProjectSurveyWorkspace> {
  const response = await apiRequest<{ item: RawSurveyWorkspace }>(
    `/v1/projects/${projectId}/survey-workspace`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return mapSurveyWorkspace(response.item);
}

export async function completeProjectSurvey(projectId: string): Promise<ProjectSurveyWorkspace> {
  const response = await apiRequest<{ item: RawSurveyWorkspace }>(
    `/v1/projects/${projectId}/survey-complete`,
    {
      method: 'POST',
    },
  );
  return mapSurveyWorkspace(response.item);
}

export async function getProjectSolutionWorkspace(projectId: string): Promise<ProjectSolutionWorkspace> {
  const response = await apiRequest<{ item: RawSolutionWorkspace }>(
    `/v1/projects/${projectId}/solution-workspace`,
  );
  return mapSolutionWorkspace(response.item);
}

export async function updateProjectSolutionWorkspace(
  projectId: string,
  input: ProjectSolutionWorkspacePayload,
): Promise<ProjectSolutionWorkspace> {
  const response = await apiRequest<{ item: RawSolutionWorkspace }>(
    `/v1/projects/${projectId}/solution-workspace`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return mapSolutionWorkspace(response.item);
}

export async function listProjectSolutionSnapshots(projectId: string): Promise<ProjectSolutionSnapshot[]> {
  const response = await apiRequest<{ items: RawSolutionSnapshot[] }>(
    `/v1/projects/${projectId}/solution-snapshots`,
  );
  return response.items.map(mapSolutionSnapshot);
}

export async function createProjectSolutionSnapshot(projectId: string): Promise<ProjectSolutionSnapshot> {
  const response = await apiRequest<{ item: RawSolutionSnapshot }>(
    `/v1/projects/${projectId}/solution-snapshots`,
    {
      method: 'POST',
    },
  );
  return mapSolutionSnapshot(response.item);
}
