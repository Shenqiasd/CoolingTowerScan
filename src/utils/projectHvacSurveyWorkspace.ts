import type { EquipmentStatus } from './projectSurveyWorkspace';

export type HvacDeviceType =
  | 'chiller'
  | 'chilled_water_pump'
  | 'cooling_water_pump'
  | 'cooling_tower'
  | 'unknown';

export type HvacReviewStatus = 'pending' | 'approved' | 'rejected';
export type HvacOperationStrategy = 'full_year' | 'partial_year';
export type HvacSavingMode = 'winter' | 'balanced' | 'summer' | 'extreme';
export type SurveyFileType = 'device_nameplate' | 'device_ledger' | 'operation_record' | 'site_photo' | 'other';
export type SurveyExtractionStatus = 'uploaded' | 'extracting' | 'needs_review' | 'reviewed' | 'failed';

export const HVAC_DEVICE_TYPE_LABELS: Record<HvacDeviceType, string> = {
  chiller: '冷机',
  chilled_water_pump: '冷冻泵',
  cooling_water_pump: '冷却泵',
  cooling_tower: '冷却塔',
  unknown: '未知设备',
};

export const HVAC_REVIEW_STATUS_LABELS: Record<HvacReviewStatus, string> = {
  pending: '待复核',
  approved: '已确认',
  rejected: '已驳回',
};

export const HVAC_SAVING_MODE_LABELS: Record<HvacSavingMode, string> = {
  winter: '冬季保守',
  balanced: '全年平衡',
  summer: '夏季强化',
  extreme: '极限节能',
};

export const SURVEY_FILE_TYPE_LABELS: Record<SurveyFileType, string> = {
  device_nameplate: '设备铭牌',
  device_ledger: '设备台账',
  operation_record: '运行记录',
  site_photo: '现场照片',
  other: '其他资料',
};

export const SURVEY_EXTRACTION_STATUS_LABELS: Record<SurveyExtractionStatus, string> = {
  uploaded: '已上传',
  extracting: '识别中',
  needs_review: '待审核',
  reviewed: '已入库',
  failed: '已驳回',
};

export interface ProjectCoolingStation {
  id: string;
  projectId: string;
  name: string;
  locationLabel: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSurveyFile {
  id: string;
  projectId: string;
  stationId: string | null;
  fileType: SurveyFileType;
  fileName: string;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  extractionStatus: SurveyExtractionStatus;
  confidence: number | null;
  errorMessage: string;
  rawExtraction: Record<string, unknown>;
  reviewedPayload: Record<string, unknown>;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectHvacEquipmentAsset {
  id: string;
  projectId: string;
  stationId: string | null;
  sourceFileId: string | null;
  deviceType: HvacDeviceType;
  equipmentName: string;
  brand: string;
  model: string;
  quantity: number;
  ratedPowerKw: number | null;
  ratedCoolingCapacityKw: number | null;
  ratedCop: number | null;
  frequencyHz: number | null;
  headM: number | null;
  flowRateM3h: number | null;
  heatExchangeCapacityKw: number | null;
  status: EquipmentStatus;
  reviewStatus: HvacReviewStatus;
  confidence: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOperationRecord {
  id: string;
  projectId: string;
  stationId: string | null;
  sourceFileId: string | null;
  recordDate: string | null;
  recordTime: string;
  shift: string;
  operatingStatus: string;
  operatingHours: number | null;
  unitsOnCount: number | null;
  operatingCurrentPct: number | null;
  loadRatePct: number | null;
  measuredEnergyKwh: number | null;
  notes: string;
  reviewStatus: HvacReviewStatus;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectEquipmentMonthlyProfile {
  id: string;
  projectId: string;
  equipmentAssetId: string;
  year: number;
  month: number;
  runNum: number;
  monthDays: number;
  runDays: number;
  runDayHours: number;
  loadRatePct: number;
  operationStrategy: HvacOperationStrategy;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectHvacEvaluationResult {
  yearEnergyBeforeKwh: number;
  yearEnergyAfterKwh: number;
  yearSavingEnergyKwh: number;
  yearSavingCostCny: number;
  yearSavingRate: number;
  byDeviceType: Record<string, {
    energyBeforeKwh: number;
    energyAfterKwh: number;
    savingEnergyKwh: number;
    savingCostCny: number;
    savingRate: number;
  }>;
  monthTrends: Array<{
    month: number;
    energyBeforeKwh: number;
    energyAfterKwh: number;
    savingEnergyKwh: number;
    savingCostCny: number;
  }>;
}

export interface ProjectHvacEvaluation {
  id: string;
  projectId: string;
  year: number;
  savingMode: HvacSavingMode;
  result: ProjectHvacEvaluationResult;
  createdBy: string | null;
  createdAt: string;
}

export interface HvacSurveyGateValidation {
  canComplete: boolean;
  errors: string[];
}

export interface ProjectHvacSurveyWorkspace {
  projectId: string;
  stations: ProjectCoolingStation[];
  files: ProjectSurveyFile[];
  equipmentAssets: ProjectHvacEquipmentAsset[];
  operationRecords: ProjectOperationRecord[];
  monthlyProfiles: ProjectEquipmentMonthlyProfile[];
  latestEvaluation: ProjectHvacEvaluation | null;
  gateValidation: HvacSurveyGateValidation;
}

export interface CoolingStationPayload {
  id?: string;
  name: string;
  locationLabel?: string;
  notes?: string;
}

export interface HvacEquipmentAssetDraft {
  id: string;
  stationId: string;
  sourceFileId: string;
  deviceType: HvacDeviceType;
  equipmentName: string;
  brand: string;
  model: string;
  quantity: string;
  ratedPowerKw: string;
  ratedCoolingCapacityKw: string;
  ratedCop: string;
  frequencyHz: string;
  headM: string;
  flowRateM3h: string;
  heatExchangeCapacityKw: string;
  status: EquipmentStatus;
  reviewStatus: HvacReviewStatus;
  confidence: string;
  notes: string;
}

export interface HvacMonthlyProfileDraft {
  id: string;
  equipmentAssetId: string;
  year: string;
  month: string;
  runNum: string;
  monthDays: string;
  runDays: string;
  runDayHours: string;
  loadRatePct: string;
  operationStrategy: HvacOperationStrategy;
}

function cleanText(value: string) {
  return value.trim();
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberToDraft(value: number | null) {
  return value === null ? '' : String(value);
}

export function createDefaultHvacSurveyWorkspace(projectId: string): ProjectHvacSurveyWorkspace {
  return {
    projectId,
    stations: [],
    files: [],
    equipmentAssets: [],
    operationRecords: [],
    monthlyProfiles: [],
    latestEvaluation: null,
    gateValidation: {
      canComplete: false,
      errors: [],
    },
  };
}

export function createEmptyHvacEquipmentDraft(stationId = ''): HvacEquipmentAssetDraft {
  return {
    id: '',
    stationId,
    sourceFileId: '',
    deviceType: 'cooling_tower',
    equipmentName: '',
    brand: '',
    model: '',
    quantity: '1',
    ratedPowerKw: '',
    ratedCoolingCapacityKw: '',
    ratedCop: '',
    frequencyHz: '50',
    headM: '',
    flowRateM3h: '',
    heatExchangeCapacityKw: '',
    status: 'running',
    reviewStatus: 'pending',
    confidence: '',
    notes: '',
  };
}

export function createHvacEquipmentDrafts(
  workspace: ProjectHvacSurveyWorkspace,
): HvacEquipmentAssetDraft[] {
  return workspace.equipmentAssets.map((item) => ({
    id: item.id,
    stationId: item.stationId ?? '',
    sourceFileId: item.sourceFileId ?? '',
    deviceType: item.deviceType,
    equipmentName: item.equipmentName,
    brand: item.brand,
    model: item.model,
    quantity: String(item.quantity),
    ratedPowerKw: numberToDraft(item.ratedPowerKw),
    ratedCoolingCapacityKw: numberToDraft(item.ratedCoolingCapacityKw),
    ratedCop: numberToDraft(item.ratedCop),
    frequencyHz: numberToDraft(item.frequencyHz),
    headM: numberToDraft(item.headM),
    flowRateM3h: numberToDraft(item.flowRateM3h),
    heatExchangeCapacityKw: numberToDraft(item.heatExchangeCapacityKw),
    status: item.status,
    reviewStatus: item.reviewStatus,
    confidence: numberToDraft(item.confidence),
    notes: item.notes,
  }));
}

export function serializeHvacEquipmentDrafts(
  drafts: HvacEquipmentAssetDraft[],
): ProjectHvacEquipmentAsset[] {
  return drafts.map((item) => ({
    id: cleanText(item.id),
    projectId: '',
    stationId: cleanText(item.stationId) || null,
    sourceFileId: cleanText(item.sourceFileId) || null,
    deviceType: item.deviceType,
    equipmentName: cleanText(item.equipmentName),
    brand: cleanText(item.brand),
    model: cleanText(item.model),
    quantity: toNumber(item.quantity),
    ratedPowerKw: toNullableNumber(item.ratedPowerKw),
    ratedCoolingCapacityKw: toNullableNumber(item.ratedCoolingCapacityKw),
    ratedCop: toNullableNumber(item.ratedCop),
    frequencyHz: toNullableNumber(item.frequencyHz),
    headM: toNullableNumber(item.headM),
    flowRateM3h: toNullableNumber(item.flowRateM3h),
    heatExchangeCapacityKw: toNullableNumber(item.heatExchangeCapacityKw),
    status: item.status,
    reviewStatus: item.reviewStatus,
    confidence: toNullableNumber(item.confidence),
    notes: cleanText(item.notes),
    createdAt: '',
    updatedAt: '',
  }));
}

export function createHvacMonthlyProfileDrafts(
  workspace: ProjectHvacSurveyWorkspace,
  equipmentAssetId: string,
  year: number,
): HvacMonthlyProfileDraft[] {
  const existing = workspace.monthlyProfiles.filter((item) => (
    item.equipmentAssetId === equipmentAssetId
    && item.year === year
  ));

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const item = existing.find((profile) => profile.month === month);
    return {
      id: item?.id ?? '',
      equipmentAssetId,
      year: String(item?.year ?? year),
      month: String(month),
      runNum: String(item?.runNum ?? 1),
      monthDays: String(item?.monthDays ?? 30),
      runDays: String(item?.runDays ?? 20),
      runDayHours: String(item?.runDayHours ?? 10),
      loadRatePct: String(item?.loadRatePct ?? 75),
      operationStrategy: item?.operationStrategy ?? 'partial_year',
    };
  });
}

export function serializeHvacMonthlyProfileDrafts(
  drafts: HvacMonthlyProfileDraft[],
): ProjectEquipmentMonthlyProfile[] {
  return drafts.map((item) => ({
    id: cleanText(item.id),
    projectId: '',
    equipmentAssetId: cleanText(item.equipmentAssetId),
    year: toNumber(item.year),
    month: toNumber(item.month),
    runNum: toNumber(item.runNum),
    monthDays: toNumber(item.monthDays),
    runDays: toNumber(item.runDays),
    runDayHours: toNumber(item.runDayHours),
    loadRatePct: toNumber(item.loadRatePct),
    operationStrategy: item.operationStrategy,
    createdAt: '',
    updatedAt: '',
  }));
}
