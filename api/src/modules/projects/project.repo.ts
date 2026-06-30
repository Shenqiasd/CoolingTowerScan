import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

import type {
  ProjectAuditLogItem,
  ProjectCoolingStation,
  ProjectDataGapItem,
  ProjectDetail,
  ProjectEquipmentMonthlyProfile,
  ProjectEquipmentLedgerItem,
  ProjectHandoffItem,
  ProjectHvacDeviceType,
  ProjectHvacEquipmentAsset,
  ProjectHvacEvaluation,
  ProjectHvacEvaluationResult,
  ProjectHvacOperationStrategy,
  ProjectHvacReviewStatus,
  ProjectHvacSavingMode,
  ProjectHvacSurveyGateValidation,
  ProjectHvacSurveyWorkspace,
  ProjectListFilters,
  ProjectLeadSnapshot,
  ProjectListItem,
  ProjectOperationRecord,
  ProjectRepo,
  ProjectSurveyExtractionStatus,
  ProjectSurveyFile,
  ProjectSurveyFileType,
  ProjectSurveyCompletionStatus,
  ProjectSurveyGateValidation,
  ProjectSurveyInfoCollection,
  ProjectSurveyRecord,
  ProjectSurveyWorkspace,
  ProjectSolutionCalculationSummary,
  ProjectSolutionCommercialBranching,
  ProjectSolutionFreezeApproval,
  ProjectSolutionFreezeDecision,
  ProjectSolutionSnapshot,
  ProjectSolutionTechnicalAssumptions,
  ProjectSolutionWorkspace,
  ProjectStageCode,
  ProjectStageGateSnapshot,
  ProjectStageItem,
  ProjectWorkflowStatus,
  RunHvacEvaluationInput,
  UpdateProjectSolutionWorkspaceInput,
  UpdateProjectSurveyWorkspaceInput,
  UpdateProjectInput,
  UpdateProjectStageInput,
  UpsertCoolingStationInput,
} from './project.schemas.js';
import { PROJECT_STAGE_CODES } from './project.schemas.js';
import {
  calculateHvacEvaluation,
  type HvacSavingModeConfig,
} from './hvac-survey-calculator.js';
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

type EnterpriseProjectSourceRow = {
  id: string;
  enterprise_name: string | null;
  address: string | null;
  industry_category: string | null;
  composite_score: number | string | null;
  probability_level: string | null;
  has_cooling_tower: boolean | null;
  cooling_tower_count: number | string | null;
  detection_confidence: number | string | null;
  total_cooling_capacity_rt: number | string | null;
  cooling_station_rated_power_kw: number | string | null;
  longitude: number | string | null;
  latitude: number | string | null;
};

type SiteRow = {
  id: string;
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

type CoolingStationRow = {
  id: string;
  project_id: string;
  name: string;
  location_label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SurveyFileRow = {
  id: string;
  project_id: string;
  station_id: string | null;
  file_type: ProjectSurveyFileType;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | string | null;
  extraction_status: ProjectSurveyExtractionStatus;
  confidence: number | string | null;
  error_message: string | null;
  raw_extraction: Record<string, unknown> | null;
  reviewed_payload: Record<string, unknown> | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type HvacEquipmentAssetRow = {
  id: string;
  project_id: string;
  station_id: string | null;
  source_file_id: string | null;
  device_type: ProjectHvacDeviceType;
  equipment_name: string | null;
  brand: string | null;
  model: string | null;
  quantity: number | string | null;
  rated_power_kw: number | string | null;
  rated_cooling_capacity_kw: number | string | null;
  rated_cop: number | string | null;
  frequency_hz: number | string | null;
  head_m: number | string | null;
  flow_rate_m3h: number | string | null;
  heat_exchange_capacity_kw: number | string | null;
  status: ProjectEquipmentLedgerItem['status'];
  review_status: ProjectHvacReviewStatus;
  confidence: number | string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OperationRecordRow = {
  id: string;
  project_id: string;
  station_id: string | null;
  source_file_id: string | null;
  record_date: string | null;
  record_time: string | null;
  shift: string | null;
  operating_status: string | null;
  operating_hours: number | string | null;
  units_on_count: number | string | null;
  operating_current_pct: number | string | null;
  load_rate_pct: number | string | null;
  measured_energy_kwh: number | string | null;
  notes: string | null;
  review_status: ProjectHvacReviewStatus;
  confidence: number | string | null;
  created_at: string;
  updated_at: string;
};

type EquipmentMonthlyProfileRow = {
  id: string;
  project_id: string;
  equipment_asset_id: string;
  year: number | string;
  month: number | string;
  run_num: number | string;
  month_days: number | string;
  run_days: number | string;
  run_day_hours: number | string;
  load_rate_pct: number | string;
  operation_strategy: ProjectHvacOperationStrategy;
  created_at: string;
  updated_at: string;
};

type HvacEvaluationRow = {
  id: string;
  project_id: string;
  year: number | string;
  saving_mode: ProjectHvacSavingMode;
  result: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

type HvacSavingModeConfigRow = {
  device_type: Exclude<ProjectHvacDeviceType, 'unknown'>;
  avg_base: number | string;
  rate1: number | string;
  rate2: number | string;
  rate3: number | string;
  rate4: number | string;
  rate5: number | string;
  rate6: number | string;
  rate7: number | string;
  rate8: number | string;
  rate9: number | string;
  rate10: number | string;
  rate11: number | string;
  rate12: number | string;
};

const HVAC_DEVICE_TYPES_FOR_SAVING: Array<Exclude<ProjectHvacDeviceType, 'unknown'>> = [
  'chiller',
  'chilled_water_pump',
  'cooling_water_pump',
  'cooling_tower',
];

const DEFAULT_SAVING_BASES: Record<ProjectHvacSavingMode, Record<Exclude<ProjectHvacDeviceType, 'unknown'>, number>> = {
  winter: {
    chiller: 0.08,
    chilled_water_pump: 0.06,
    cooling_water_pump: 0.06,
    cooling_tower: 0.07,
  },
  balanced: {
    chiller: 0.08,
    chilled_water_pump: 0.06,
    cooling_water_pump: 0.06,
    cooling_tower: 0.07,
  },
  summer: {
    chiller: 0.08,
    chilled_water_pump: 0.06,
    cooling_water_pump: 0.06,
    cooling_tower: 0.07,
  },
  extreme: {
    chiller: 0.10,
    chilled_water_pump: 0.08,
    cooling_water_pump: 0.08,
    cooling_tower: 0.09,
  },
};

const DEFAULT_MONTHLY_RATES: Record<ProjectHvacSavingMode, HvacSavingModeConfig['monthlyRates']> = {
  winter: [1.20, 1.20, 1.05, 0.90, 0.80, 0.75, 0.70, 0.70, 0.80, 0.95, 1.15, 1.20],
  balanced: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  summer: [0.70, 0.70, 0.80, 0.95, 1.10, 1.20, 1.25, 1.25, 1.10, 0.95, 0.80, 0.70],
  extreme: [1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10],
};

function getDefaultSavingModeConfigs(savingMode: ProjectHvacSavingMode): HvacSavingModeConfig[] {
  return HVAC_DEVICE_TYPES_FOR_SAVING.map((deviceType) => ({
    deviceType,
    avgBase: DEFAULT_SAVING_BASES[savingMode][deviceType],
    monthlyRates: DEFAULT_MONTHLY_RATES[savingMode],
  }));
}

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

function generateSiteCode() {
  return `SITE-${Date.now()}`;
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

function getDefaultSolutionFreezeApproval(): ProjectSolutionFreezeApproval {
  return {
    status: 'idle',
    requestedAt: null,
    requestedBy: null,
    requestedSnapshotVersion: null,
    requestedBranchType: null,
    decidedAt: null,
    decidedBy: null,
    decisionComment: '',
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

function getSolutionFreezeApproval(
  phaseData: Record<string, unknown> | null | undefined,
): ProjectSolutionFreezeApproval {
  const proposalPhase = getPhaseDataValue(phaseData, 'proposal');
  const workspace = proposalPhase.solutionWorkspace;
  const value = workspace && typeof workspace === 'object' && !Array.isArray(workspace)
    ? workspace as Record<string, unknown>
    : {};
  const approval = value.commercialFreezeApproval;
  const source = approval && typeof approval === 'object' && !Array.isArray(approval)
    ? approval as Record<string, unknown>
    : {};
  const defaults = getDefaultSolutionFreezeApproval();

  return {
    status: source.status === 'pending_approval'
      || source.status === 'approved'
      || source.status === 'rejected'
      ? source.status
      : defaults.status,
    requestedAt: typeof source.requestedAt === 'string' ? source.requestedAt : defaults.requestedAt,
    requestedBy: typeof source.requestedBy === 'string' ? source.requestedBy : defaults.requestedBy,
    requestedSnapshotVersion: getNullableNumber(source.requestedSnapshotVersion),
    requestedBranchType: source.requestedBranchType === 'epc' || source.requestedBranchType === 'emc'
      ? source.requestedBranchType
      : defaults.requestedBranchType,
    decidedAt: typeof source.decidedAt === 'string' ? source.decidedAt : defaults.decidedAt,
    decidedBy: typeof source.decidedBy === 'string' ? source.decidedBy : defaults.decidedBy,
    decisionComment: typeof source.decisionComment === 'string'
      ? source.decisionComment
      : defaults.decisionComment,
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

export function buildSolutionCalculationSummaryFromHvacEvaluation(
  evaluation: ProjectHvacEvaluation | null,
): {
  calculationSummary: ProjectSolutionCalculationSummary | null;
  gateErrors: string[];
} {
  if (!evaluation) {
    return {
      calculationSummary: null,
      gateErrors: [],
    };
  }

  const result = evaluation.result;
  const gateErrors: string[] = [];
  if (result.yearEnergyBeforeKwh <= 0) {
    gateErrors.push('hvac evaluation baseline annual energy must be greater than 0');
  }
  if (result.yearEnergyAfterKwh < 0) {
    gateErrors.push('hvac evaluation target annual energy must be greater than or equal to 0');
  }
  if (result.yearSavingEnergyKwh <= 0) {
    gateErrors.push('hvac evaluation annual saving must be greater than 0');
  }
  if (result.yearEnergyAfterKwh >= result.yearEnergyBeforeKwh) {
    gateErrors.push('hvac evaluation target annual energy must be lower than baseline annual energy');
  }

  return {
    calculationSummary: {
      baselineAnnualEnergyKwh: result.yearEnergyBeforeKwh,
      targetAnnualEnergyKwh: result.yearEnergyAfterKwh,
      annualPowerSavingKwh: result.yearSavingEnergyKwh,
      annualCostSavingCny: result.yearSavingCostCny,
      efficiencyImprovementRatio: result.yearSavingRate,
      baselineCoolingPowerKw: 0,
      targetCoolingPowerKw: 0,
    },
    gateErrors,
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
  } else {
    if ((branching.emc.sharedSavingRate ?? 0) <= 0) {
      errors.push('emc.sharedSavingRate must be greater than 0');
    }
    if ((branching.emc.contractYears ?? 0) <= 0) {
      errors.push('emc.contractYears must be greater than 0');
    }
  }

  if (!branching.freezeReady) {
    errors.push('commercial freezeReady must be confirmed');
  }

  return errors;
}

function getSolutionLastSnapshotVersion(
  phaseData: Record<string, unknown> | null | undefined,
): number {
  const proposalPhase = getPhaseDataValue(phaseData, 'proposal');
  const workspace = proposalPhase.solutionWorkspace;
  const value = workspace && typeof workspace === 'object' && !Array.isArray(workspace)
    ? workspace as Record<string, unknown>
    : {};

  return getNullableNumber(value.lastSnapshotVersion) ?? 0;
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

function mapCoolingStation(row: CoolingStationRow): ProjectCoolingStation {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    locationLabel: row.location_label ?? '',
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSurveyFile(row: SurveyFileRow): ProjectSurveyFile {
  return {
    id: row.id,
    projectId: row.project_id,
    stationId: row.station_id,
    fileType: row.file_type,
    fileName: row.file_name,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type ?? '',
    fileSize: parseNumber(row.file_size),
    extractionStatus: row.extraction_status,
    confidence: getNullableNumber(row.confidence),
    errorMessage: row.error_message ?? '',
    rawExtraction: row.raw_extraction ?? {},
    reviewedPayload: row.reviewed_payload ?? {},
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHvacEquipmentAsset(row: HvacEquipmentAssetRow): ProjectHvacEquipmentAsset {
  return {
    id: row.id,
    projectId: row.project_id,
    stationId: row.station_id,
    sourceFileId: row.source_file_id,
    deviceType: row.device_type,
    equipmentName: row.equipment_name ?? '',
    brand: row.brand ?? '',
    model: row.model ?? '',
    quantity: parseNumber(row.quantity) || 1,
    ratedPowerKw: getNullableNumber(row.rated_power_kw),
    ratedCoolingCapacityKw: getNullableNumber(row.rated_cooling_capacity_kw),
    ratedCop: getNullableNumber(row.rated_cop),
    frequencyHz: getNullableNumber(row.frequency_hz),
    headM: getNullableNumber(row.head_m),
    flowRateM3h: getNullableNumber(row.flow_rate_m3h),
    heatExchangeCapacityKw: getNullableNumber(row.heat_exchange_capacity_kw),
    status: row.status,
    reviewStatus: row.review_status,
    confidence: getNullableNumber(row.confidence),
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOperationRecord(row: OperationRecordRow): ProjectOperationRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    stationId: row.station_id,
    sourceFileId: row.source_file_id,
    recordDate: row.record_date,
    recordTime: row.record_time ?? '',
    shift: row.shift ?? '',
    operatingStatus: row.operating_status ?? '',
    operatingHours: getNullableNumber(row.operating_hours),
    unitsOnCount: getNullableNumber(row.units_on_count),
    operatingCurrentPct: getNullableNumber(row.operating_current_pct),
    loadRatePct: getNullableNumber(row.load_rate_pct),
    measuredEnergyKwh: getNullableNumber(row.measured_energy_kwh),
    notes: row.notes ?? '',
    reviewStatus: row.review_status,
    confidence: getNullableNumber(row.confidence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEquipmentMonthlyProfile(row: EquipmentMonthlyProfileRow): ProjectEquipmentMonthlyProfile {
  return {
    id: row.id,
    projectId: row.project_id,
    equipmentAssetId: row.equipment_asset_id,
    year: parseNumber(row.year),
    month: parseNumber(row.month),
    runNum: parseNumber(row.run_num),
    monthDays: parseNumber(row.month_days),
    runDays: parseNumber(row.run_days),
    runDayHours: parseNumber(row.run_day_hours),
    loadRatePct: parseNumber(row.load_rate_pct),
    operationStrategy: row.operation_strategy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function emptyHvacEvaluationResult(): ProjectHvacEvaluationResult {
  return {
    yearEnergyBeforeKwh: 0,
    yearEnergyAfterKwh: 0,
    yearSavingEnergyKwh: 0,
    yearSavingCostCny: 0,
    yearSavingRate: 0,
    byDeviceType: {},
    monthTrends: [],
  };
}

function mapHvacEvaluation(row: HvacEvaluationRow): ProjectHvacEvaluation {
  return {
    id: row.id,
    projectId: row.project_id,
    year: parseNumber(row.year),
    savingMode: row.saving_mode,
    result: {
      ...emptyHvacEvaluationResult(),
      ...(row.result ?? {}),
    } as ProjectHvacEvaluationResult,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapHvacSavingModeConfig(row: HvacSavingModeConfigRow): HvacSavingModeConfig {
  return {
    deviceType: row.device_type,
    avgBase: parseNumber(row.avg_base),
    monthlyRates: [
      parseNumber(row.rate1),
      parseNumber(row.rate2),
      parseNumber(row.rate3),
      parseNumber(row.rate4),
      parseNumber(row.rate5),
      parseNumber(row.rate6),
      parseNumber(row.rate7),
      parseNumber(row.rate8),
      parseNumber(row.rate9),
      parseNumber(row.rate10),
      parseNumber(row.rate11),
      parseNumber(row.rate12),
    ],
  };
}

function isMissingRelationError(error: unknown) {
  const value = error as { code?: unknown; message?: unknown } | null;
  return value?.code === 'PGRST205'
    || (typeof value?.message === 'string' && value.message.includes('schema cache'));
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getTypedArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function getStoredHvacWorkspace(phaseData: Record<string, unknown> | null | undefined) {
  const surveyPhase = getPhaseDataValue(phaseData, 'survey');
  return getRecord(surveyPhase.hvacWorkspace);
}

function getFallbackHvacEvaluation(
  phaseData: Record<string, unknown> | null | undefined,
): ProjectHvacEvaluation | null {
  const workspace = getStoredHvacWorkspace(phaseData);
  const evaluation = getRecord(workspace.latestEvaluation);
  return typeof evaluation.id === 'string'
    ? evaluation as unknown as ProjectHvacEvaluation
    : null;
}

function buildFallbackHvacWorkspace(
  project: ProjectRow,
  dataGaps: ProjectDataGapItem[] = [],
  handoffs: ProjectHandoffItem[] = [],
): ProjectHvacSurveyWorkspace {
  const workspace = getStoredHvacWorkspace(project.phase_data);
  const stations = getTypedArray<ProjectCoolingStation>(workspace.stations);
  const files = getTypedArray<ProjectSurveyFile>(workspace.files);
  const equipmentAssets = getTypedArray<ProjectHvacEquipmentAsset>(workspace.equipmentAssets);
  const operationRecords = getTypedArray<ProjectOperationRecord>(workspace.operationRecords);
  const monthlyProfiles = getTypedArray<ProjectEquipmentMonthlyProfile>(workspace.monthlyProfiles);
  const latestEvaluation = getFallbackHvacEvaluation(project.phase_data);
  const gateValidation = buildHvacSurveyGateValidation({
    infoCollection: getSurveyInfoCollection(project.phase_data),
    surveyRecord: getSurveyRecord(project.phase_data),
    stations,
    equipmentAssets,
    monthlyProfiles,
    dataGaps,
    handoffs,
  });

  return {
    projectId: project.id,
    stations,
    files,
    equipmentAssets,
    operationRecords,
    monthlyProfiles,
    latestEvaluation,
    gateValidation,
  };
}

async function updateFallbackHvacWorkspace(
  supabaseAdmin: SupabaseClient,
  project: ProjectRow,
  nextWorkspace: ProjectHvacSurveyWorkspace,
) {
  const surveyPhase = getPhaseDataValue(project.phase_data, 'survey');
  const phaseData = {
    ...(project.phase_data ?? {}),
    survey: {
      ...surveyPhase,
      hvacWorkspace: {
        stations: nextWorkspace.stations,
        files: nextWorkspace.files,
        equipmentAssets: nextWorkspace.equipmentAssets,
        operationRecords: nextWorkspace.operationRecords,
        monthlyProfiles: nextWorkspace.monthlyProfiles,
        latestEvaluation: nextWorkspace.latestEvaluation,
      },
    },
  };

  const { error } = await supabaseAdmin
    .from('projects')
    .update({ phase_data: phaseData })
    .eq('id', project.id);

  if (error) {
    throw error;
  }
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

export function buildHvacSurveyGateValidation(input: {
  infoCollection: ProjectSurveyInfoCollection;
  surveyRecord: ProjectSurveyRecord;
  stations: ProjectCoolingStation[];
  equipmentAssets: ProjectHvacEquipmentAsset[];
  monthlyProfiles: ProjectEquipmentMonthlyProfile[];
  dataGaps: ProjectDataGapItem[];
  handoffs: ProjectHandoffItem[];
}): ProjectHvacSurveyGateValidation {
  const baseGate = buildSurveyGateValidation(
    input.infoCollection,
    input.surveyRecord,
    input.equipmentAssets.map((asset) => ({
      id: asset.id,
      equipmentName: asset.equipmentName,
      equipmentType: asset.deviceType,
      locationLabel: asset.stationId ?? '',
      quantity: asset.quantity,
      capacityRt: asset.ratedCoolingCapacityKw ? asset.ratedCoolingCapacityKw / 3.517 : 0,
      status: asset.status,
      notes: asset.notes,
    })),
    input.dataGaps,
    input.handoffs,
  );
  const errors = [...baseGate.errors];
  const approvedAssets = input.equipmentAssets.filter((asset) => asset.reviewStatus === 'approved');

  if (input.stations.length === 0) {
    errors.push('at least one cooling station is required');
  }
  if (approvedAssets.length === 0) {
    errors.push('approved HVAC equipment is required');
  }

  for (const asset of approvedAssets) {
    const label = asset.equipmentName || asset.model || asset.id;
    if (asset.deviceType === 'unknown') {
      errors.push(`equipment ${label} deviceType must be known`);
    }
    if (!asset.model.trim()) {
      errors.push(`equipment ${label} model is required`);
    }
    if ((asset.ratedPowerKw ?? 0) <= 0) {
      errors.push(`equipment ${label} ratedPowerKw must be greater than 0`);
    }

    const profileCount = input.monthlyProfiles.filter((profile) => profile.equipmentAssetId === asset.id).length;
    if (profileCount !== 12) {
      errors.push(`equipment ${label} requires 12 monthly profiles`);
    }
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
  const commercialBranching = getSolutionCommercialBranching(row.phase_data);
  const { gateErrors: technicalGateErrors } = getSolutionCalculationSummary(
    getSolutionTechnicalAssumptions(row.phase_data),
  );
  const commercialGateErrors = getSolutionCommercialGateErrors(commercialBranching);
  const gateErrors = [...technicalGateErrors, ...commercialGateErrors];

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
    commercialBranchType: commercialBranching.branchType,
    commercialFreezeReady: commercialBranching.freezeReady,
    solutionCanSnapshot: gateErrors.length === 0,
    solutionGateErrorCount: gateErrors.length,
    lastSolutionSnapshotVersion: getSolutionLastSnapshotVersion(row.phase_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stages: current.stages,
  };
}

function mapProjectListItem(row: ProjectRow): ProjectListItem {
  const current = resolveCurrentStage(row);
  const commercialBranching = getSolutionCommercialBranching(row.phase_data);
  const { gateErrors: technicalGateErrors } = getSolutionCalculationSummary(
    getSolutionTechnicalAssumptions(row.phase_data),
  );
  const commercialGateErrors = getSolutionCommercialGateErrors(commercialBranching);
  const gateErrors = [...technicalGateErrors, ...commercialGateErrors];

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
    commercialBranchType: commercialBranching.branchType,
    commercialFreezeReady: commercialBranching.freezeReady,
    solutionCanSnapshot: gateErrors.length === 0,
    solutionGateErrorCount: gateErrors.length,
    lastSolutionSnapshotVersion: getSolutionLastSnapshotVersion(row.phase_data),
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

async function getExistingProjectByEnterprise(
  supabaseAdmin: SupabaseClient,
  enterpriseId: string,
): Promise<ProjectRow | null> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('enterprise_id', enterpriseId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProjectRow | null;
}

async function getEnterpriseProjectSource(
  supabaseAdmin: SupabaseClient,
  enterpriseId: string | undefined,
): Promise<EnterpriseProjectSourceRow | null> {
  let query = supabaseAdmin
    .from('enterprises')
    .select(`
      id,
      enterprise_name,
      address,
      industry_category,
      composite_score,
      probability_level,
      has_cooling_tower,
      cooling_tower_count,
      detection_confidence,
      total_cooling_capacity_rt,
      cooling_station_rated_power_kw,
      longitude,
      latitude
    `);

  if (enterpriseId) {
    query = query.eq('id', enterpriseId);
  } else {
    query = query
      .order('has_cooling_tower', { ascending: false })
      .order('composite_score', { ascending: false })
      .order('updated_at', { ascending: false });
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    throw error;
  }

  return data as EnterpriseProjectSourceRow | null;
}

async function ensurePrimarySite(
  supabaseAdmin: SupabaseClient,
  enterprise: EnterpriseProjectSourceRow,
): Promise<string | null> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('sites')
    .select('id')
    .eq('enterprise_id', enterprise.id)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if ((existing as SiteRow | null)?.id) {
    return (existing as SiteRow).id;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('sites')
    .insert({
      enterprise_id: enterprise.id,
      site_name: enterprise.enterprise_name || '默认站点',
      site_code: generateSiteCode(),
      address: enterprise.address ?? '',
      normalized_address: enterprise.address ?? '',
      longitude_gcj02: enterprise.longitude,
      latitude_gcj02: enterprise.latitude,
      coordinate_status: enterprise.longitude && enterprise.latitude ? 'success' : 'pending',
      coordinate_source: 'import',
      is_primary: true,
      metadata: {
        initializedFrom: 'survey-bootstrap',
      },
    })
    .select('id')
    .maybeSingle();

  if (insertError) {
    throw insertError;
  }

  return (inserted as SiteRow | null)?.id ?? null;
}

async function initializeProjectStages(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  actorUserId: string,
  initializedFrom = 'survey-bootstrap',
) {
  const timestamp = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('project_stage_states')
    .upsert(
      PROJECT_STAGE_CODES.map((stageCode) => {
        const completed = stageCode === 'prospecting' || stageCode === 'qualification';
        const active = stageCode === 'survey';
        return {
          project_id: projectId,
          stage_code: stageCode,
          status: completed ? 'completed' : active ? 'in_progress' : 'not_started',
          entered_at: completed || active ? timestamp : null,
          completed_at: completed ? timestamp : null,
          blockers: [],
          gate_snapshot: {
            initializedBy: actorUserId,
            initializedFrom,
          },
        };
      }),
      {
        onConflict: 'project_id,stage_code',
        ignoreDuplicates: false,
      },
    );

  if (error) {
    throw error;
  }
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

async function getCoolingStationRows(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectCoolingStation[]> {
  const { data, error } = await supabaseAdmin
    .from('project_cooling_stations')
    .select('id, project_id, name, location_label, notes, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapCoolingStation(item as CoolingStationRow));
}

async function getSurveyFileRows(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectSurveyFile[]> {
  const { data, error } = await supabaseAdmin
    .from('project_survey_files')
    .select('id, project_id, station_id, file_type, file_name, storage_bucket, storage_path, mime_type, file_size, extraction_status, confidence, error_message, raw_extraction, reviewed_payload, created_by, reviewed_by, reviewed_at, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapSurveyFile(item as SurveyFileRow));
}

async function getHvacEquipmentAssetRows(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectHvacEquipmentAsset[]> {
  const { data, error } = await supabaseAdmin
    .from('project_hvac_equipment_assets')
    .select('id, project_id, station_id, source_file_id, device_type, equipment_name, brand, model, quantity, rated_power_kw, rated_cooling_capacity_kw, rated_cop, frequency_hz, head_m, flow_rate_m3h, heat_exchange_capacity_kw, status, review_status, confidence, notes, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapHvacEquipmentAsset(item as HvacEquipmentAssetRow));
}

async function getOperationRecordRows(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectOperationRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('project_operation_records')
    .select('id, project_id, station_id, source_file_id, record_date, record_time, shift, operating_status, operating_hours, units_on_count, operating_current_pct, load_rate_pct, measured_energy_kwh, notes, review_status, confidence, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapOperationRecord(item as OperationRecordRow));
}

async function getEquipmentMonthlyProfileRows(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectEquipmentMonthlyProfile[]> {
  const { data, error } = await supabaseAdmin
    .from('project_equipment_monthly_profiles')
    .select('id, project_id, equipment_asset_id, year, month, run_num, month_days, run_days, run_day_hours, load_rate_pct, operation_strategy, created_at, updated_at')
    .eq('project_id', projectId)
    .order('year', { ascending: false })
    .order('month', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => mapEquipmentMonthlyProfile(item as EquipmentMonthlyProfileRow));
}

async function getLatestHvacEvaluation(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectHvacEvaluation | null> {
  const { data, error } = await supabaseAdmin
    .from('project_hvac_evaluations')
    .select('id, project_id, year, saving_mode, result, created_by, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapHvacEvaluation(data as HvacEvaluationRow) : null;
}

async function getProjectHvacSurveyWorkspace(
  supabaseAdmin: SupabaseClient,
  projectId: string,
): Promise<ProjectHvacSurveyWorkspace | null> {
  const project = await getProjectRow(supabaseAdmin, projectId);
  if (!project) {
    return null;
  }

  let stations: ProjectCoolingStation[];
  let files: ProjectSurveyFile[];
  let equipmentAssets: ProjectHvacEquipmentAsset[];
  let operationRecords: ProjectOperationRecord[];
  let monthlyProfiles: ProjectEquipmentMonthlyProfile[];
  let latestEvaluation: ProjectHvacEvaluation | null;
  let dataGaps: ProjectDataGapItem[];
  let handoffs: ProjectHandoffItem[];

  try {
    [
      stations,
      files,
      equipmentAssets,
      operationRecords,
      monthlyProfiles,
      latestEvaluation,
      dataGaps,
      handoffs,
    ] = await Promise.all([
      getCoolingStationRows(supabaseAdmin, projectId),
      getSurveyFileRows(supabaseAdmin, projectId),
      getHvacEquipmentAssetRows(supabaseAdmin, projectId),
      getOperationRecordRows(supabaseAdmin, projectId),
      getEquipmentMonthlyProfileRows(supabaseAdmin, projectId),
      getLatestHvacEvaluation(supabaseAdmin, projectId),
      getDataGapRows(supabaseAdmin, projectId),
      getHandoffRows(supabaseAdmin, projectId),
    ]);
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }

    return buildFallbackHvacWorkspace(project);
  }

  const gateValidation = buildHvacSurveyGateValidation({
    infoCollection: getSurveyInfoCollection(project.phase_data),
    surveyRecord: getSurveyRecord(project.phase_data),
    stations,
    equipmentAssets,
    monthlyProfiles,
    dataGaps,
    handoffs,
  });

  return {
    projectId,
    stations,
    files,
    equipmentAssets,
    operationRecords,
    monthlyProfiles,
    latestEvaluation,
    gateValidation,
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
  const commercialFreezeApproval = getSolutionFreezeApproval(project.phase_data);
  let latestHvacEvaluation: ProjectHvacEvaluation | null;
  try {
    latestHvacEvaluation = await getLatestHvacEvaluation(supabaseAdmin, projectId);
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }
    latestHvacEvaluation = getFallbackHvacEvaluation(project.phase_data);
  }
  const hvacCalculation = buildSolutionCalculationSummaryFromHvacEvaluation(latestHvacEvaluation);
  const fallbackCalculation = getSolutionCalculationSummary(assumptions);
  const calculationSummary = hvacCalculation.calculationSummary ?? fallbackCalculation.calculationSummary;
  const technicalGateErrors = hvacCalculation.calculationSummary
    ? hvacCalculation.gateErrors
    : fallbackCalculation.gateErrors;
  const commercialGateErrors = getSolutionCommercialGateErrors(commercialBranching);
  const gateErrors = [...technicalGateErrors, ...commercialGateErrors];
  const latestSnapshot = await getLatestSolutionSnapshot(supabaseAdmin, projectId);

  return {
    projectId,
    technicalAssumptions: assumptions,
    commercialBranching,
    commercialFreezeApproval,
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

async function insertSolutionSnapshotRecord(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  workspace: ProjectSolutionWorkspace,
  actorUserId: string,
  timestamp: string,
) {
  const latestSnapshot = await getLatestSolutionSnapshot(supabaseAdmin, projectId);
  const nextVersion = (latestSnapshot?.versionNo ?? 0) + 1;
  const { data, error } = await supabaseAdmin
    .from('project_solution_snapshots')
    .insert({
      project_id: projectId,
      stage_code: 'proposal',
      version_no: nextVersion,
      snapshot_payload: {
        technicalAssumptions: workspace.technicalAssumptions,
        commercialBranching: workspace.commercialBranching,
        commercialFreezeApproval: workspace.commercialFreezeApproval,
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

  return {
    snapshot: mapSolutionSnapshot(data as SolutionSnapshotRow),
    nextVersion,
  };
}

function validateCoolingStationInput(input: UpsertCoolingStationInput) {
  if (!input.name.trim()) {
    throw new Error('cooling station name is required');
  }
}

function validateHvacEquipmentAssets(items: ProjectHvacEquipmentAsset[]) {
  for (const item of items) {
    if (!item.equipmentName.trim() && !item.model.trim()) {
      throw new Error('equipmentName or model is required');
    }
    if (item.deviceType === 'unknown' && item.reviewStatus === 'approved') {
      throw new Error('approved equipment deviceType must be known');
    }
    if ((item.ratedPowerKw ?? 0) <= 0 && item.reviewStatus === 'approved') {
      throw new Error('approved equipment ratedPowerKw must be greater than 0');
    }
    if (item.quantity <= 0) {
      throw new Error('equipment quantity must be greater than 0');
    }
  }
}

function validateMonthlyProfiles(items: ProjectEquipmentMonthlyProfile[]) {
  for (const item of items) {
    if (item.year < 2000 || item.year > 2100) {
      throw new Error('monthly profile year is invalid');
    }
    if (item.month < 1 || item.month > 12) {
      throw new Error('monthly profile month must be between 1 and 12');
    }
    if (item.monthDays < 1 || item.monthDays > 31) {
      throw new Error('monthly profile monthDays must be between 1 and 31');
    }
    if (item.runDays < 0 || item.runDays > item.monthDays) {
      throw new Error('monthly profile runDays must be between 0 and monthDays');
    }
    if (item.runDayHours < 0 || item.runDayHours > 24) {
      throw new Error('monthly profile runDayHours must be between 0 and 24');
    }
    if (item.loadRatePct < 0 || item.loadRatePct > 100) {
      throw new Error('monthly profile loadRatePct must be between 0 and 100');
    }
  }
}

async function getSavingModeConfigs(
  supabaseAdmin: SupabaseClient,
  savingMode: ProjectHvacSavingMode,
): Promise<HvacSavingModeConfig[]> {
  const { data, error } = await supabaseAdmin
    .from('hvac_saving_mode_configs')
    .select('device_type, avg_base, rate1, rate2, rate3, rate4, rate5, rate6, rate7, rate8, rate9, rate10, rate11, rate12')
    .eq('saving_mode', savingMode);

  if (error) {
    if (isMissingRelationError(error)) {
      return getDefaultSavingModeConfigs(savingMode);
    }
    throw error;
  }

  const items = (data ?? []).map((item) => mapHvacSavingModeConfig(item as HvacSavingModeConfigRow));
  return items.length > 0 ? items : getDefaultSavingModeConfigs(savingMode);
}

async function upsertCoolingStationRecord(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  input: UpsertCoolingStationInput,
) {
  validateCoolingStationInput(input);

  if (input.id) {
    const { error } = await supabaseAdmin
      .from('project_cooling_stations')
      .update({
        name: input.name.trim(),
        location_label: input.locationLabel?.trim() ?? '',
        notes: input.notes?.trim() ?? '',
      })
      .eq('id', input.id)
      .eq('project_id', projectId);

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabaseAdmin
    .from('project_cooling_stations')
    .insert({
      project_id: projectId,
      name: input.name.trim(),
      location_label: input.locationLabel?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
    });

  if (error) {
    throw error;
  }
}

async function replaceHvacEquipmentAssets(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  items: ProjectHvacEquipmentAsset[],
) {
  validateHvacEquipmentAssets(items);

  const { error: deleteError } = await supabaseAdmin
    .from('project_hvac_equipment_assets')
    .delete()
    .eq('project_id', projectId);

  if (deleteError) {
    throw deleteError;
  }

  if (items.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('project_hvac_equipment_assets')
    .insert(items.map((item) => ({
      id: item.id || undefined,
      project_id: projectId,
      station_id: item.stationId,
      source_file_id: item.sourceFileId,
      device_type: item.deviceType,
      equipment_name: item.equipmentName,
      brand: item.brand,
      model: item.model,
      quantity: item.quantity,
      rated_power_kw: item.ratedPowerKw,
      rated_cooling_capacity_kw: item.ratedCoolingCapacityKw,
      rated_cop: item.ratedCop,
      frequency_hz: item.frequencyHz,
      head_m: item.headM,
      flow_rate_m3h: item.flowRateM3h,
      heat_exchange_capacity_kw: item.heatExchangeCapacityKw,
      status: item.status,
      review_status: item.reviewStatus,
      confidence: item.confidence,
      notes: item.notes,
    })));

  if (error) {
    throw error;
  }
}

async function replaceProjectMonthlyProfiles(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  items: ProjectEquipmentMonthlyProfile[],
) {
  validateMonthlyProfiles(items);

  const { error: deleteError } = await supabaseAdmin
    .from('project_equipment_monthly_profiles')
    .delete()
    .eq('project_id', projectId);

  if (deleteError) {
    throw deleteError;
  }

  if (items.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('project_equipment_monthly_profiles')
    .insert(items.map((item) => ({
      id: item.id || undefined,
      project_id: projectId,
      equipment_asset_id: item.equipmentAssetId,
      year: item.year,
      month: item.month,
      run_num: item.runNum,
      month_days: item.monthDays,
      run_days: item.runDays,
      run_day_hours: item.runDayHours,
      load_rate_pct: item.loadRatePct,
      operation_strategy: item.operationStrategy,
    })));

  if (error) {
    throw error;
  }
}

async function insertHvacEvaluationRecord(
  supabaseAdmin: SupabaseClient,
  projectId: string,
  input: RunHvacEvaluationInput,
  actorUserId: string,
) {
  const project = await getProjectRow(supabaseAdmin, projectId);
  if (!project) {
    return;
  }

  const electricityPricePerKwh = input.electricityPricePerKwh
    ?? getSolutionTechnicalAssumptions(project.phase_data).electricityPricePerKwh
    ?? 0;
  if (electricityPricePerKwh <= 0) {
    throw new Error('electricityPricePerKwh must be greater than 0');
  }

  const [equipmentAssets, monthlyProfiles, savingConfigs] = await Promise.all([
    getHvacEquipmentAssetRows(supabaseAdmin, projectId),
    getEquipmentMonthlyProfileRows(supabaseAdmin, projectId),
    getSavingModeConfigs(supabaseAdmin, input.savingMode),
  ]);
  const result = calculateHvacEvaluation({
    electricityPricePerKwh,
    equipmentAssets: equipmentAssets
      .filter((asset) => asset.reviewStatus === 'approved')
      .map((asset) => ({
        id: asset.id,
        deviceType: asset.deviceType,
        ratedPowerKw: asset.ratedPowerKw,
      })),
    monthlyProfiles: monthlyProfiles
      .filter((profile) => profile.year === input.year)
      .map((profile) => ({
        equipmentAssetId: profile.equipmentAssetId,
        month: profile.month,
        runNum: profile.runNum,
        runDays: profile.runDays,
        runDayHours: profile.runDayHours,
        loadRatePct: profile.loadRatePct,
      })),
    savingConfigs,
  });

  const { error } = await supabaseAdmin
    .from('project_hvac_evaluations')
    .insert({
      project_id: projectId,
      year: input.year,
      saving_mode: input.savingMode,
      result,
      created_by: actorUserId || null,
    });

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
          current_phase: 'survey',
          workflow_status: 'active',
          status: 'active',
          priority: lead.priority ?? 'medium',
          assigned_to: actorUserId,
          phase_data: {
            prospecting: {
              source: 'lead-conversion',
            },
            qualification: {
              status: 'qualified',
              source: 'lead-conversion',
            },
            survey: {
              infoCollection: {
                siteContactName: '',
                siteContactPhone: '',
                siteAccessWindow: '',
                operatingSchedule: '',
                coolingSystemType: '',
                powerAccessStatus: '',
                waterTreatmentStatus: '',
                notes: '',
              },
              surveyRecord: {
                surveyDate: '',
                surveyOwnerUserId: actorUserId,
                participantNames: [],
                onSiteFindings: '',
                loadProfileSummary: '',
                retrofitConstraints: '',
                nextActions: '补充冷冻站、设备台账和运行记录后执行能效评估。',
              },
              riskSummary: '',
            },
            proposal: {},
            bidding: {},
            execution: {},
            commissioning: {},
            operations: {},
          },
        })
        .select('id')
        .maybeSingle();

      if (projectError) {
        throw projectError;
      }

      if (!projectData?.id) {
        return null;
      }

      await initializeProjectStages(supabaseAdmin, projectData.id, actorUserId, 'lead-conversion');

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

    async createSurveyProjectFromEnterprise(enterpriseId, actorUserId) {
      const enterprise = await getEnterpriseProjectSource(supabaseAdmin, enterpriseId?.trim() || undefined);
      if (!enterprise) {
        return null;
      }

      const existing = await getExistingProjectByEnterprise(supabaseAdmin, enterprise.id);
      if (existing) {
        return mapProject(existing);
      }

      const siteId = await ensurePrimarySite(supabaseAdmin, enterprise);
      const phaseData = {
        prospecting: {
          hasCoolingTower: enterprise.has_cooling_tower ?? false,
          coolingTowerCount: parseNumber(enterprise.cooling_tower_count),
          detectionConfidence: parseNumber(enterprise.detection_confidence),
          totalCoolingCapacityRt: parseNumber(enterprise.total_cooling_capacity_rt),
          coolingStationRatedPowerKw: parseNumber(enterprise.cooling_station_rated_power_kw),
          probabilityLevel: enterprise.probability_level ?? '',
          compositeScore: parseNumber(enterprise.composite_score),
          industryCategory: enterprise.industry_category ?? '',
          source: 'enterprise-discovery',
        },
        qualification: {
          status: 'imported_from_discovery',
        },
        survey: {
          infoCollection: {
            siteContactName: '',
            siteContactPhone: '',
            siteAccessWindow: '',
            operatingSchedule: '',
            coolingSystemType: '',
            powerAccessStatus: '',
            waterTreatmentStatus: '',
            notes: enterprise.address ? `企业地址：${enterprise.address}` : '',
          },
          surveyRecord: {
            surveyDate: '',
            surveyOwnerUserId: actorUserId,
            participantNames: [],
            onSiteFindings: '',
            loadProfileSummary: '',
            retrofitConstraints: '',
            nextActions: '补充冷冻站、设备台账和运行记录后执行能效评估。',
          },
          riskSummary: '',
        },
        proposal: {},
        bidding: {},
        execution: {},
        commissioning: {},
        operations: {},
      };

      const { data, error } = await supabaseAdmin
        .from('projects')
        .insert({
          project_code: generateProjectCode(),
          lead_id: null,
          enterprise_id: enterprise.id,
          site_id: siteId,
          name: enterprise.enterprise_name || '未命名踏勘项目',
          current_phase: 'survey',
          workflow_status: 'active',
          status: 'active',
          priority: enterprise.has_cooling_tower ? 'high' : 'medium',
          assigned_to: actorUserId,
          opportunity_score: parseNumber(enterprise.composite_score),
          phase_data: phaseData,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        return null;
      }

      await initializeProjectStages(supabaseAdmin, data.id, actorUserId);
      await insertProjectAuditLog(supabaseAdmin, data.id, 'project.survey_bootstrapped', actorUserId, {
        enterpriseId: enterprise.id,
        siteId,
      });

      return getProjectById(supabaseAdmin, data.id);
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

    async getProjectHvacSurveyWorkspace(projectId) {
      return getProjectHvacSurveyWorkspace(supabaseAdmin, projectId);
    },

    async upsertCoolingStation(projectId, input, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      try {
        await upsertCoolingStationRecord(supabaseAdmin, projectId, input);
      } catch (error) {
        if (!isMissingRelationError(error)) {
          throw error;
        }
        validateCoolingStationInput(input);
        const now = new Date().toISOString();
        const workspace = buildFallbackHvacWorkspace(existing);
        const stationId = input.id || randomUUID();
        const nextStation: ProjectCoolingStation = {
          id: stationId,
          projectId,
          name: input.name.trim(),
          locationLabel: input.locationLabel?.trim() ?? '',
          notes: input.notes?.trim() ?? '',
          createdAt: workspace.stations.find((station) => station.id === stationId)?.createdAt ?? now,
          updatedAt: now,
        };
        await updateFallbackHvacWorkspace(supabaseAdmin, existing, {
          ...workspace,
          stations: [
            ...workspace.stations.filter((station) => station.id !== stationId),
            nextStation,
          ],
        });
      }
      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.hvacSurvey.station.upserted', actorUserId, {
        stationId: input.id ?? null,
        name: input.name,
      });

      return getProjectHvacSurveyWorkspace(supabaseAdmin, projectId);
    },

    async deleteCoolingStation(projectId, stationId, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      const { error } = await supabaseAdmin
        .from('project_cooling_stations')
        .delete()
        .eq('id', stationId)
        .eq('project_id', projectId);

      if (error) {
        if (!isMissingRelationError(error)) {
          throw error;
        }
        const workspace = buildFallbackHvacWorkspace(existing);
        await updateFallbackHvacWorkspace(supabaseAdmin, existing, {
          ...workspace,
          stations: workspace.stations.filter((station) => station.id !== stationId),
          equipmentAssets: workspace.equipmentAssets.map((asset) => (
            asset.stationId === stationId ? { ...asset, stationId: null } : asset
          )),
          operationRecords: workspace.operationRecords.map((record) => (
            record.stationId === stationId ? { ...record, stationId: null } : record
          )),
        });
      }

      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.hvacSurvey.station.deleted', actorUserId, {
        stationId,
      });

      return getProjectHvacSurveyWorkspace(supabaseAdmin, projectId);
    },

    async upsertHvacEquipmentAssets(projectId, input, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      try {
        await replaceHvacEquipmentAssets(supabaseAdmin, projectId, input);
      } catch (error) {
        if (!isMissingRelationError(error)) {
          throw error;
        }
        validateHvacEquipmentAssets(input);
        const workspace = buildFallbackHvacWorkspace(existing);
        await updateFallbackHvacWorkspace(supabaseAdmin, existing, {
          ...workspace,
          equipmentAssets: input,
        });
      }
      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.hvacSurvey.equipment.updated', actorUserId, {
        count: input.length,
      });

      return getProjectHvacSurveyWorkspace(supabaseAdmin, projectId);
    },

    async replaceMonthlyProfiles(projectId, input, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      try {
        await replaceProjectMonthlyProfiles(supabaseAdmin, projectId, input);
      } catch (error) {
        if (!isMissingRelationError(error)) {
          throw error;
        }
        validateMonthlyProfiles(input);
        const workspace = buildFallbackHvacWorkspace(existing);
        await updateFallbackHvacWorkspace(supabaseAdmin, existing, {
          ...workspace,
          monthlyProfiles: input,
        });
      }
      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.hvacSurvey.monthlyProfiles.replaced', actorUserId, {
        count: input.length,
      });

      return getProjectHvacSurveyWorkspace(supabaseAdmin, projectId);
    },

    async runHvacEvaluation(projectId, input, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      try {
        await insertHvacEvaluationRecord(supabaseAdmin, projectId, input, actorUserId);
      } catch (error) {
        if (!isMissingRelationError(error)) {
          throw error;
        }
        const electricityPricePerKwh = input.electricityPricePerKwh
          ?? getSolutionTechnicalAssumptions(existing.phase_data).electricityPricePerKwh
          ?? 0;
        if (electricityPricePerKwh <= 0) {
          throw new Error('electricityPricePerKwh must be greater than 0');
        }
        const workspace = buildFallbackHvacWorkspace(existing);
        const result = calculateHvacEvaluation({
          electricityPricePerKwh,
          equipmentAssets: workspace.equipmentAssets
            .filter((asset) => asset.reviewStatus === 'approved')
            .map((asset) => ({
              id: asset.id,
              deviceType: asset.deviceType,
              ratedPowerKw: asset.ratedPowerKw,
            })),
          monthlyProfiles: workspace.monthlyProfiles
            .filter((profile) => profile.year === input.year)
            .map((profile) => ({
              equipmentAssetId: profile.equipmentAssetId,
              month: profile.month,
              runNum: profile.runNum,
              runDays: profile.runDays,
              runDayHours: profile.runDayHours,
              loadRatePct: profile.loadRatePct,
            })),
          savingConfigs: getDefaultSavingModeConfigs(input.savingMode),
        });
        await updateFallbackHvacWorkspace(supabaseAdmin, existing, {
          ...workspace,
          latestEvaluation: {
            id: randomUUID(),
            projectId,
            year: input.year,
            savingMode: input.savingMode,
            result,
            createdBy: actorUserId || null,
            createdAt: new Date().toISOString(),
          },
        });
      }
      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.hvacSurvey.evaluation.run', actorUserId, {
        year: input.year,
        savingMode: input.savingMode,
      });

      return getProjectHvacSurveyWorkspace(supabaseAdmin, projectId);
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
      const currentProposalPhase = getPhaseDataValue(existing.phase_data, 'proposal');
      const { error: projectError } = await supabaseAdmin
        .from('projects')
        .update({
          current_phase: 'proposal',
          phase_data: {
            ...(existing.phase_data ?? {}),
            survey: {
              ...currentSurveyPhase,
              infoCollection: getSurveyInfoCollection(existing.phase_data),
              surveyRecord: getSurveyRecord(existing.phase_data),
              completionStatus: 'completed',
              completedAt: timestamp,
            },
            proposal: {
              ...currentProposalPhase,
              enteredFromSurveyAt: timestamp,
              previousSurveyCompletedAt: timestamp,
            },
          },
        })
        .eq('id', projectId);

      if (projectError) {
        throw projectError;
      }

      const existingStage = (existing.project_stage_states ?? []).find((item) => item.stage_code === 'survey');
      const existingProposalStage = (existing.project_stage_states ?? []).find((item) => item.stage_code === 'proposal');
      const proposalStatus = existingProposalStage?.status === 'completed' || existingProposalStage?.status === 'pending_approval'
        ? existingProposalStage.status
        : 'in_progress';
      const { error: stageError } = await supabaseAdmin
        .from('project_stage_states')
        .upsert([
          {
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
              nextGateLabel: '已交接至方案报价',
            },
            completed_at: timestamp,
          },
          {
            project_id: projectId,
            stage_code: 'proposal',
            status: proposalStatus,
            entered_at: existingProposalStage?.entered_at ?? timestamp,
            due_at: existingProposalStage?.due_at ?? null,
            owner_user_id: existingProposalStage?.owner_user_id ?? null,
            approver_user_id: existingProposalStage?.approver_user_id ?? null,
            blockers: existingProposalStage?.blockers ?? [],
            gate_snapshot: {
              ...(existingProposalStage?.gate_snapshot ?? {}),
              enteredFromSurveyAt: timestamp,
              previousSurveyCompletedAt: timestamp,
              nextGateLabel: existingProposalStage?.gate_snapshot?.nextGateLabel ?? '生成方案并提交商业冻结',
            },
            completed_at: existingProposalStage?.completed_at ?? null,
          },
        ], {
          onConflict: 'project_id,stage_code',
          ignoreDuplicates: false,
        });

      if (stageError) {
        throw stageError;
      }

      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.survey.completed', actorUserId, {
        completedAt: timestamp,
        nextStage: 'proposal',
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
                commercialFreezeApproval: currentWorkspace.commercialFreezeApproval,
                lastSnapshotVersion: currentWorkspace.lastSnapshotVersion,
                lastSnapshotAt: currentWorkspace.lastSnapshotAt,
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

    async requestProjectSolutionFreeze(projectId, actorUserId) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      const workspace = await getProjectSolutionWorkspace(supabaseAdmin, projectId);
      if (!workspace) {
        return null;
      }

      const timestamp = new Date().toISOString();
      const { nextVersion } = await insertSolutionSnapshotRecord(
        supabaseAdmin,
        projectId,
        workspace,
        actorUserId,
        timestamp,
      );
      const existingStage = (existing.project_stage_states ?? []).find((item) => item.stage_code === 'proposal');
      const currentProposalPhase = getPhaseDataValue(existing.phase_data, 'proposal');
      const currentWorkspace = currentProposalPhase.solutionWorkspace
        && typeof currentProposalPhase.solutionWorkspace === 'object'
        && !Array.isArray(currentProposalPhase.solutionWorkspace)
        ? currentProposalPhase.solutionWorkspace as Record<string, unknown>
        : {};
      const freezeApproval: ProjectSolutionFreezeApproval = {
        status: 'pending_approval',
        requestedAt: timestamp,
        requestedBy: actorUserId || null,
        requestedSnapshotVersion: nextVersion,
        requestedBranchType: workspace.commercialBranching.branchType,
        decidedAt: null,
        decidedBy: null,
        decisionComment: '',
      };

      const { error: projectError } = await supabaseAdmin
        .from('projects')
        .update({
          phase_data: {
            ...(existing.phase_data ?? {}),
            proposal: {
              ...currentProposalPhase,
              solutionWorkspace: {
                ...currentWorkspace,
                technicalAssumptions: workspace.technicalAssumptions,
                commercialBranching: workspace.commercialBranching,
                commercialFreezeApproval: freezeApproval,
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

      const { error: stageError } = await supabaseAdmin
        .from('project_stage_states')
        .upsert({
          project_id: projectId,
          stage_code: 'proposal',
          status: 'pending_approval',
          owner_user_id: existingStage?.owner_user_id ?? null,
          approver_user_id: existingStage?.approver_user_id ?? null,
          entered_at: existingStage?.entered_at ?? timestamp,
          due_at: existingStage?.due_at ?? null,
          completed_at: null,
          blockers: existingStage?.blockers ?? [],
          gate_snapshot: {
            ...(existingStage?.gate_snapshot ?? {}),
            nextGateLabel: '等待商业冻结审批',
          },
        }, {
          onConflict: 'project_id,stage_code',
          ignoreDuplicates: false,
        });

      if (stageError) {
        throw stageError;
      }

      await insertProjectAuditLog(supabaseAdmin, projectId, 'project.solution.freeze_requested', actorUserId, {
        versionNo: nextVersion,
        requestedAt: timestamp,
        branchType: workspace.commercialBranching.branchType,
      });

      return getProjectSolutionWorkspace(supabaseAdmin, projectId);
    },

    async decideProjectSolutionFreeze(projectId, decision, actorUserId, comment) {
      const existing = await getProjectRow(supabaseAdmin, projectId);
      if (!existing) {
        return null;
      }

      const workspace = await getProjectSolutionWorkspace(supabaseAdmin, projectId);
      if (!workspace) {
        return null;
      }

      const timestamp = new Date().toISOString();
      const existingStage = (existing.project_stage_states ?? []).find((item) => item.stage_code === 'proposal');
      const currentProposalPhase = getPhaseDataValue(existing.phase_data, 'proposal');
      const currentWorkspace = currentProposalPhase.solutionWorkspace
        && typeof currentProposalPhase.solutionWorkspace === 'object'
        && !Array.isArray(currentProposalPhase.solutionWorkspace)
        ? currentProposalPhase.solutionWorkspace as Record<string, unknown>
        : {};
      const nextFreezeApproval: ProjectSolutionFreezeApproval = {
        ...workspace.commercialFreezeApproval,
        status: decision === 'approve' ? 'approved' : 'rejected',
        decidedAt: timestamp,
        decidedBy: actorUserId || null,
        decisionComment: comment?.trim() ?? '',
      };

      const { error: projectError } = await supabaseAdmin
        .from('projects')
        .update({
          phase_data: {
            ...(existing.phase_data ?? {}),
            proposal: {
              ...currentProposalPhase,
              solutionWorkspace: {
                ...currentWorkspace,
                technicalAssumptions: workspace.technicalAssumptions,
                commercialBranching: workspace.commercialBranching,
                commercialFreezeApproval: nextFreezeApproval,
                lastSnapshotVersion: workspace.lastSnapshotVersion,
                lastSnapshotAt: workspace.lastSnapshotAt,
              },
            },
          },
        })
        .eq('id', projectId);

      if (projectError) {
        throw projectError;
      }

      const { error: stageError } = await supabaseAdmin
        .from('project_stage_states')
        .upsert({
          project_id: projectId,
          stage_code: 'proposal',
          status: decision === 'approve' ? 'completed' : 'in_progress',
          owner_user_id: existingStage?.owner_user_id ?? null,
          approver_user_id: existingStage?.approver_user_id ?? null,
          entered_at: existingStage?.entered_at ?? timestamp,
          due_at: existingStage?.due_at ?? null,
          completed_at: decision === 'approve' ? timestamp : null,
          blockers: existingStage?.blockers ?? [],
          gate_snapshot: {
            ...(existingStage?.gate_snapshot ?? {}),
            nextGateLabel: decision === 'approve' ? '商业冻结审批已通过' : '补充修改后重新提交冻结审批',
          },
        }, {
          onConflict: 'project_id,stage_code',
          ignoreDuplicates: false,
        });

      if (stageError) {
        throw stageError;
      }

      await insertProjectAuditLog(
        supabaseAdmin,
        projectId,
        decision === 'approve' ? 'project.solution.freeze_approved' : 'project.solution.freeze_rejected',
        actorUserId,
        {
          versionNo: workspace.commercialFreezeApproval.requestedSnapshotVersion,
          decidedAt: timestamp,
          decisionComment: comment?.trim() ?? '',
        },
      );

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

      const timestamp = new Date().toISOString();
      const { snapshot, nextVersion } = await insertSolutionSnapshotRecord(
        supabaseAdmin,
        projectId,
        workspace,
        actorUserId,
        timestamp,
      );

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
                commercialFreezeApproval: workspace.commercialFreezeApproval,
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

      return snapshot;
    },
  };
}
