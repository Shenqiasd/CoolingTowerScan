import type { FastifyInstance } from 'fastify';

import { AppError } from '../plugins/errors.js';
import { ProjectService } from '../modules/projects/project.service.js';
import {
  PROJECT_DATA_GAP_STATUSES,
  PROJECT_DATA_GAP_TYPES,
  PROJECT_EQUIPMENT_STATUSES,
  PROJECT_HANDOFF_STATUSES,
  PROJECT_HVAC_DEVICE_TYPES,
  PROJECT_HVAC_OPERATION_STRATEGIES,
  PROJECT_HVAC_REVIEW_STATUSES,
  PROJECT_HVAC_SAVING_MODES,
  PROJECT_PRIORITIES,
  PROJECT_SURVEY_EXTRACTION_STATUSES,
  PROJECT_SURVEY_FILE_TYPES,
  PROJECT_SOLUTION_FREEZE_DECISIONS,
  PROJECT_STAGE_CODES,
  PROJECT_STAGE_STATUSES,
  PROJECT_WORKFLOW_STATUSES,
  type ProjectDataGapItem,
  type ProjectEquipmentMonthlyProfile,
  type ProjectEquipmentLedgerItem,
  type ProjectEquipmentStatus,
  type ProjectHandoffItem,
  type ProjectHvacDeviceType,
  type ProjectHvacEquipmentAsset,
  type ProjectHvacOperationStrategy,
  type ProjectHvacReviewStatus,
  type ProjectHvacSavingMode,
  type ProjectSurveyExtractionStatus,
  type ProjectSurveyFileType,
  type ProjectRepo,
  type RunHvacEvaluationInput,
  type ProjectStageCode,
  type ProjectStageStatus,
  type ProjectSolutionTechnicalAssumptions,
  type ProjectSolutionCommercialBranching,
  type ProjectCommercialBranchType,
  type ProjectWorkflowStatus,
  type ProjectSurveyInfoCollection,
  type ProjectSurveyRecord,
  type UpsertCoolingStationInput,
} from '../modules/projects/project.schemas.js';

declare module 'fastify' {
  interface FastifyInstance {
    projectRepo: ProjectRepo;
  }
}

function parseRequiredString(value: unknown, code: string, message: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw new AppError(400, code, message);
}

function parsePhase(value: unknown): ProjectStageCode | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  if (PROJECT_STAGE_CODES.includes(value as ProjectStageCode)) {
    return value as ProjectStageCode;
  }

  throw new AppError(400, 'PROJECT_PHASE_INVALID', 'Project phase is invalid.');
}

function parseOptionalString(value: unknown, code: string, message: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  throw new AppError(400, code, message);
}

function parseNullableString(value: unknown, code: string, message: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  throw new AppError(400, code, message);
}

function parseOptionalNumber(value: unknown, code: string, message: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  throw new AppError(400, code, message);
}

function parseRequiredNumber(value: unknown, code: string, message: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  throw new AppError(400, code, message);
}

function parseNullableNumber(value: unknown, code: string, message: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  throw new AppError(400, code, message);
}

function parseOptionalRecord(value: unknown, code: string, message: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new AppError(400, code, message);
}

function parseOptionalPriority(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' && PROJECT_PRIORITIES.includes(value as typeof PROJECT_PRIORITIES[number])) {
    return value as typeof PROJECT_PRIORITIES[number];
  }

  throw new AppError(400, 'PROJECT_PRIORITY_INVALID', 'Project priority is invalid.');
}

function parseOptionalWorkflowStatus(value: unknown): ProjectWorkflowStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value === 'string'
    && PROJECT_WORKFLOW_STATUSES.includes(value as ProjectWorkflowStatus)
  ) {
    return value as ProjectWorkflowStatus;
  }

  throw new AppError(400, 'PROJECT_WORKFLOW_STATUS_INVALID', 'Project workflow status is invalid.');
}

function parseOptionalStageStatus(value: unknown): ProjectStageStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value === 'string'
    && PROJECT_STAGE_STATUSES.includes(value as ProjectStageStatus)
  ) {
    return value as ProjectStageStatus;
  }

  throw new AppError(400, 'PROJECT_STAGE_STATUS_INVALID', 'Project stage status is invalid.');
}

function parseOptionalStringArray(value: unknown, code: string, message: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }

  throw new AppError(400, code, message);
}

function parseOptionalBlockers(value: unknown): unknown[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  throw new AppError(400, 'PROJECT_STAGE_BLOCKERS_INVALID', 'Project stage blockers must be an array.');
}

function parseOptionalObject(value: unknown, code: string, message: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new AppError(400, code, message);
}

function parseSurveyInfoCollection(value: unknown): Partial<ProjectSurveyInfoCollection> | undefined {
  const object = parseOptionalObject(
    value,
    'PROJECT_SURVEY_INFO_COLLECTION_INVALID',
    'Survey info collection must be an object.',
  );
  if (!object) {
    return undefined;
  }

  const result: Partial<ProjectSurveyInfoCollection> = {};
  const keys: Array<keyof ProjectSurveyInfoCollection> = [
    'siteContactName',
    'siteContactPhone',
    'siteAccessWindow',
    'operatingSchedule',
    'coolingSystemType',
    'powerAccessStatus',
    'waterTreatmentStatus',
    'notes',
  ];
  for (const key of keys) {
    if (object[key] !== undefined) {
      if (typeof object[key] !== 'string') {
        throw new AppError(400, 'PROJECT_SURVEY_INFO_COLLECTION_INVALID', `${key} must be a string.`);
      }
      result[key] = object[key] as string;
    }
  }

  return result;
}

function parseSurveyRecord(value: unknown): Partial<ProjectSurveyRecord> | undefined {
  const object = parseOptionalObject(
    value,
    'PROJECT_SURVEY_RECORD_INVALID',
    'Survey record must be an object.',
  );
  if (!object) {
    return undefined;
  }

  const result: Partial<ProjectSurveyRecord> = {};
  const stringKeys: Array<keyof Omit<ProjectSurveyRecord, 'participantNames' | 'surveyDate' | 'surveyOwnerUserId'>> = [
    'onSiteFindings',
    'loadProfileSummary',
    'retrofitConstraints',
    'nextActions',
  ];
  for (const key of stringKeys) {
    if (object[key] !== undefined) {
      if (typeof object[key] !== 'string') {
        throw new AppError(400, 'PROJECT_SURVEY_RECORD_INVALID', `${key} must be a string.`);
      }
      result[key] = object[key] as string;
    }
  }
  if (object.surveyDate !== undefined) {
    if (object.surveyDate !== null && typeof object.surveyDate !== 'string') {
      throw new AppError(400, 'PROJECT_SURVEY_RECORD_INVALID', 'surveyDate must be a string or null.');
    }
    result.surveyDate = object.surveyDate as string | null;
  }
  if (object.surveyOwnerUserId !== undefined) {
    if (object.surveyOwnerUserId !== null && typeof object.surveyOwnerUserId !== 'string') {
      throw new AppError(400, 'PROJECT_SURVEY_RECORD_INVALID', 'surveyOwnerUserId must be a string or null.');
    }
    result.surveyOwnerUserId = object.surveyOwnerUserId as string | null;
  }
  if (object.participantNames !== undefined) {
    result.participantNames = parseOptionalStringArray(
      object.participantNames,
      'PROJECT_SURVEY_RECORD_INVALID',
      'participantNames must be a string array.',
    );
  }

  return result;
}

function parseEquipmentLedger(value: unknown): ProjectEquipmentLedgerItem[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, 'PROJECT_EQUIPMENT_LEDGER_INVALID', 'Equipment ledger must be an array.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(400, 'PROJECT_EQUIPMENT_LEDGER_INVALID', `Equipment ledger item ${index} must be an object.`);
    }
    const item = entry as Record<string, unknown>;
    const status = item.status;
    if (typeof status !== 'string' || !PROJECT_EQUIPMENT_STATUSES.includes(status as typeof PROJECT_EQUIPMENT_STATUSES[number])) {
      throw new AppError(400, 'PROJECT_EQUIPMENT_LEDGER_INVALID', `Equipment ledger item ${index} has invalid status.`);
    }
    const quantity = item.quantity;
    const capacityRt = item.capacityRt;
    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
      throw new AppError(400, 'PROJECT_EQUIPMENT_LEDGER_INVALID', `Equipment ledger item ${index} quantity must be a number.`);
    }
    if (typeof capacityRt !== 'number' || !Number.isFinite(capacityRt)) {
      throw new AppError(400, 'PROJECT_EQUIPMENT_LEDGER_INVALID', `Equipment ledger item ${index} capacityRt must be a number.`);
    }

    return {
      id: typeof item.id === 'string' ? item.id : '',
      equipmentName: typeof item.equipmentName === 'string' ? item.equipmentName : '',
      equipmentType: typeof item.equipmentType === 'string' ? item.equipmentType : '',
      locationLabel: typeof item.locationLabel === 'string' ? item.locationLabel : '',
      quantity,
      capacityRt,
      status: status as ProjectEquipmentLedgerItem['status'],
      notes: typeof item.notes === 'string' ? item.notes : '',
    };
  });
}

function parseDataGaps(value: unknown): ProjectDataGapItem[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, 'PROJECT_DATA_GAPS_INVALID', 'Project data gaps must be an array.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(400, 'PROJECT_DATA_GAPS_INVALID', `Project data gap ${index} must be an object.`);
    }
    const item = entry as Record<string, unknown>;
    const stageCode = parsePhase(item.stageCode) ?? 'survey';
    const gapType = item.gapType;
    const status = item.status;
    if (typeof gapType !== 'string' || !PROJECT_DATA_GAP_TYPES.includes(gapType as typeof PROJECT_DATA_GAP_TYPES[number])) {
      throw new AppError(400, 'PROJECT_DATA_GAPS_INVALID', `Project data gap ${index} has invalid gapType.`);
    }
    if (typeof status !== 'string' || !PROJECT_DATA_GAP_STATUSES.includes(status as typeof PROJECT_DATA_GAP_STATUSES[number])) {
      throw new AppError(400, 'PROJECT_DATA_GAPS_INVALID', `Project data gap ${index} has invalid status.`);
    }

    return {
      id: typeof item.id === 'string' ? item.id : '',
      stageCode,
      gapType: gapType as ProjectDataGapItem['gapType'],
      title: typeof item.title === 'string' ? item.title : '',
      detail: typeof item.detail === 'string' ? item.detail : '',
      status: status as ProjectDataGapItem['status'],
      ownerUserId: item.ownerUserId === null ? null : typeof item.ownerUserId === 'string' ? item.ownerUserId : null,
      dueAt: item.dueAt === null ? null : typeof item.dueAt === 'string' ? item.dueAt : null,
      waiverReason: typeof item.waiverReason === 'string' ? item.waiverReason : '',
    };
  });
}

function parseHandoffs(value: unknown): ProjectHandoffItem[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, 'PROJECT_HANDOFFS_INVALID', 'Project handoffs must be an array.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(400, 'PROJECT_HANDOFFS_INVALID', `Project handoff ${index} must be an object.`);
    }
    const item = entry as Record<string, unknown>;
    const status = item.status;
    if (typeof status !== 'string' || !PROJECT_HANDOFF_STATUSES.includes(status as typeof PROJECT_HANDOFF_STATUSES[number])) {
      throw new AppError(400, 'PROJECT_HANDOFFS_INVALID', `Project handoff ${index} has invalid status.`);
    }

    return {
      id: typeof item.id === 'string' ? item.id : '',
      fromStage: parsePhase(item.fromStage) ?? 'survey',
      toStage: parsePhase(item.toStage) ?? 'proposal',
      title: typeof item.title === 'string' ? item.title : '',
      detail: typeof item.detail === 'string' ? item.detail : '',
      status: status as ProjectHandoffItem['status'],
      ownerUserId: item.ownerUserId === null ? null : typeof item.ownerUserId === 'string' ? item.ownerUserId : null,
      dueAt: item.dueAt === null ? null : typeof item.dueAt === 'string' ? item.dueAt : null,
      payload: item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
        ? item.payload as Record<string, unknown>
        : {},
    };
  });
}

function parseSolutionTechnicalAssumptions(value: unknown): Partial<ProjectSolutionTechnicalAssumptions> | undefined {
  const object = parseOptionalObject(
    value,
    'PROJECT_SOLUTION_ASSUMPTIONS_INVALID',
    'Solution technical assumptions must be an object.',
  );
  if (!object) {
    return undefined;
  }

  return {
    baselineLoadRt: parseNullableNumber(
      object.baselineLoadRt,
      'PROJECT_SOLUTION_ASSUMPTIONS_INVALID',
      'baselineLoadRt must be a number or null.',
    ),
    targetLoadRt: parseNullableNumber(
      object.targetLoadRt,
      'PROJECT_SOLUTION_ASSUMPTIONS_INVALID',
      'targetLoadRt must be a number or null.',
    ),
    operatingHoursPerYear: parseNullableNumber(
      object.operatingHoursPerYear,
      'PROJECT_SOLUTION_ASSUMPTIONS_INVALID',
      'operatingHoursPerYear must be a number or null.',
    ),
    electricityPricePerKwh: parseNullableNumber(
      object.electricityPricePerKwh,
      'PROJECT_SOLUTION_ASSUMPTIONS_INVALID',
      'electricityPricePerKwh must be a number or null.',
    ),
    baselineCop: parseNullableNumber(
      object.baselineCop,
      'PROJECT_SOLUTION_ASSUMPTIONS_INVALID',
      'baselineCop must be a number or null.',
    ),
    targetCop: parseNullableNumber(
      object.targetCop,
      'PROJECT_SOLUTION_ASSUMPTIONS_INVALID',
      'targetCop must be a number or null.',
    ),
    systemLossFactor: parseNullableNumber(
      object.systemLossFactor,
      'PROJECT_SOLUTION_ASSUMPTIONS_INVALID',
      'systemLossFactor must be a number or null.',
    ),
  };
}

function parseOptionalCommercialBranchType(value: unknown): ProjectCommercialBranchType | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (value === 'epc' || value === 'emc') {
    return value;
  }
  throw new AppError(400, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'commercial branchType must be epc, emc, or null.');
}

function parseSolutionCommercialBranching(
  value: unknown,
): Partial<ProjectSolutionCommercialBranching> | undefined {
  const object = parseOptionalObject(
    value,
    'PROJECT_SOLUTION_BRANCHING_INVALID',
    'Solution commercial branching must be an object.',
  );
  if (!object) {
    return undefined;
  }

  const result: Partial<ProjectSolutionCommercialBranching> = {
    branchType: parseOptionalCommercialBranchType(object.branchType),
  };

  if (object.branchDecisionNote !== undefined) {
    if (typeof object.branchDecisionNote !== 'string') {
      throw new AppError(400, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'branchDecisionNote must be a string.');
    }
    result.branchDecisionNote = object.branchDecisionNote;
  }

  if (object.freezeReady !== undefined) {
    if (typeof object.freezeReady !== 'boolean') {
      throw new AppError(400, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'freezeReady must be a boolean.');
    }
    result.freezeReady = object.freezeReady;
  }

  const epc = parseOptionalObject(
    object.epc,
    'PROJECT_SOLUTION_BRANCHING_INVALID',
    'epc commercial fields must be an object.',
  );
  if (epc) {
    result.epc = {
      capexCny: parseNullableNumber(epc.capexCny, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'epc.capexCny must be a number or null.') ?? null,
      grossMarginRate: parseNullableNumber(epc.grossMarginRate, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'epc.grossMarginRate must be a number or null.') ?? null,
      deliveryMonths: parseNullableNumber(epc.deliveryMonths, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'epc.deliveryMonths must be a number or null.') ?? null,
    };
  }

  const emc = parseOptionalObject(
    object.emc,
    'PROJECT_SOLUTION_BRANCHING_INVALID',
    'emc commercial fields must be an object.',
  );
  if (emc) {
    result.emc = {
      sharedSavingRate: parseNullableNumber(emc.sharedSavingRate, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'emc.sharedSavingRate must be a number or null.') ?? null,
      contractYears: parseNullableNumber(emc.contractYears, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'emc.contractYears must be a number or null.') ?? null,
      guaranteedSavingRate: parseNullableNumber(emc.guaranteedSavingRate, 'PROJECT_SOLUTION_BRANCHING_INVALID', 'emc.guaranteedSavingRate must be a number or null.') ?? null,
    };
  }

  return result;
}

function parseSolutionFreezeDecision(value: unknown) {
  if (
    typeof value === 'string'
    && PROJECT_SOLUTION_FREEZE_DECISIONS.includes(value as typeof PROJECT_SOLUTION_FREEZE_DECISIONS[number])
  ) {
    return value as typeof PROJECT_SOLUTION_FREEZE_DECISIONS[number];
  }

  throw new AppError(400, 'PROJECT_SOLUTION_FREEZE_DECISION_INVALID', 'Solution freeze decision is invalid.');
}

function parseHvacDeviceType(value: unknown, index: number): ProjectHvacDeviceType {
  if (
    typeof value === 'string'
    && PROJECT_HVAC_DEVICE_TYPES.includes(value as ProjectHvacDeviceType)
  ) {
    return value as ProjectHvacDeviceType;
  }

  throw new AppError(400, 'PROJECT_HVAC_EQUIPMENT_INVALID', `HVAC equipment ${index} deviceType is invalid.`);
}

function parseEquipmentStatus(value: unknown, index: number): ProjectEquipmentStatus {
  if (
    typeof value === 'string'
    && PROJECT_EQUIPMENT_STATUSES.includes(value as ProjectEquipmentStatus)
  ) {
    return value as ProjectEquipmentStatus;
  }

  throw new AppError(400, 'PROJECT_HVAC_EQUIPMENT_INVALID', `HVAC equipment ${index} status is invalid.`);
}

function parseHvacReviewStatus(value: unknown, index: number): ProjectHvacReviewStatus {
  if (
    typeof value === 'string'
    && PROJECT_HVAC_REVIEW_STATUSES.includes(value as ProjectHvacReviewStatus)
  ) {
    return value as ProjectHvacReviewStatus;
  }

  throw new AppError(400, 'PROJECT_HVAC_EQUIPMENT_INVALID', `HVAC equipment ${index} reviewStatus is invalid.`);
}

function parseHvacOperationStrategy(value: unknown, index: number): ProjectHvacOperationStrategy {
  if (
    typeof value === 'string'
    && PROJECT_HVAC_OPERATION_STRATEGIES.includes(value as ProjectHvacOperationStrategy)
  ) {
    return value as ProjectHvacOperationStrategy;
  }

  throw new AppError(400, 'PROJECT_HVAC_MONTHLY_PROFILE_INVALID', `HVAC monthly profile ${index} operationStrategy is invalid.`);
}

function parseHvacSavingMode(value: unknown): ProjectHvacSavingMode {
  if (
    typeof value === 'string'
    && PROJECT_HVAC_SAVING_MODES.includes(value as ProjectHvacSavingMode)
  ) {
    return value as ProjectHvacSavingMode;
  }

  throw new AppError(400, 'PROJECT_HVAC_EVALUATION_INVALID', 'HVAC savingMode is invalid.');
}

function parseSurveyFileType(value: unknown): ProjectSurveyFileType {
  if (
    typeof value === 'string'
    && PROJECT_SURVEY_FILE_TYPES.includes(value as ProjectSurveyFileType)
  ) {
    return value as ProjectSurveyFileType;
  }

  throw new AppError(400, 'PROJECT_SURVEY_FILE_INVALID', 'Survey fileType is invalid.');
}

function parseSurveyExtractionStatus(value: unknown): ProjectSurveyExtractionStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value === 'string'
    && PROJECT_SURVEY_EXTRACTION_STATUSES.includes(value as ProjectSurveyExtractionStatus)
  ) {
    return value as ProjectSurveyExtractionStatus;
  }

  throw new AppError(400, 'PROJECT_SURVEY_FILE_INVALID', 'Survey extractionStatus is invalid.');
}

function parseCoolingStationInput(value: Record<string, unknown>, stationId?: string): UpsertCoolingStationInput {
  return {
    id: stationId,
    name: parseRequiredString(
      value.name,
      'PROJECT_HVAC_STATION_NAME_REQUIRED',
      'Cooling station name is required.',
    ),
    locationLabel: parseOptionalString(
      value.locationLabel,
      'PROJECT_HVAC_STATION_LOCATION_INVALID',
      'Cooling station locationLabel must be a string.',
    ),
    notes: parseOptionalString(
      value.notes,
      'PROJECT_HVAC_STATION_NOTES_INVALID',
      'Cooling station notes must be a string.',
    ),
  };
}

function parseSurveyFileInput(value: Record<string, unknown>) {
  return {
    stationId: parseNullableString(
      value.stationId,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey stationId must be a string or null.',
    ),
    fileType: parseSurveyFileType(value.fileType),
    fileName: parseRequiredString(
      value.fileName,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey fileName is required.',
    ),
    storageBucket: parseOptionalString(
      value.storageBucket,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey storageBucket must be a string.',
    ),
    storagePath: parseRequiredString(
      value.storagePath,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey storagePath is required.',
    ),
    contentBase64: parseOptionalString(
      value.contentBase64,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey contentBase64 must be a string.',
    ),
    mimeType: parseOptionalString(
      value.mimeType,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey mimeType must be a string.',
    ),
    fileSize: parseOptionalNumber(
      value.fileSize,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey fileSize must be a number.',
    ),
    extractionStatus: parseSurveyExtractionStatus(value.extractionStatus),
    confidence: parseNullableNumber(
      value.confidence,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey confidence must be a number or null.',
    ),
    errorMessage: parseOptionalString(
      value.errorMessage,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey errorMessage must be a string.',
    ),
    rawExtraction: parseOptionalRecord(
      value.rawExtraction,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey rawExtraction must be an object.',
    ),
    reviewedPayload: parseOptionalRecord(
      value.reviewedPayload,
      'PROJECT_SURVEY_FILE_INVALID',
      'Survey reviewedPayload must be an object.',
    ),
  };
}

function parseSurveyFileReviewInput(value: Record<string, unknown>) {
  const decision = value.decision;
  if (decision !== 'approve' && decision !== 'reject') {
    throw new AppError(400, 'PROJECT_SURVEY_FILE_REVIEW_INVALID', 'Survey review decision is invalid.');
  }
  const parsedDecision: 'approve' | 'reject' = decision;

  return {
    decision: parsedDecision,
    reviewedPayload: parseOptionalRecord(
      value.reviewedPayload,
      'PROJECT_SURVEY_FILE_REVIEW_INVALID',
      'Survey reviewedPayload must be an object.',
    ),
    errorMessage: parseOptionalString(
      value.errorMessage,
      'PROJECT_SURVEY_FILE_REVIEW_INVALID',
      'Survey errorMessage must be a string.',
    ),
  };
}

function parseHvacEquipmentAssets(value: unknown): ProjectHvacEquipmentAsset[] {
  if (!Array.isArray(value)) {
    throw new AppError(400, 'PROJECT_HVAC_EQUIPMENT_INVALID', 'HVAC equipment assets must be an array.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(400, 'PROJECT_HVAC_EQUIPMENT_INVALID', `HVAC equipment ${index} must be an object.`);
    }
    const item = entry as Record<string, unknown>;
    const reviewStatus = item.reviewStatus === undefined
      ? 'pending'
      : parseHvacReviewStatus(item.reviewStatus, index);

    return {
      id: typeof item.id === 'string' ? item.id : '',
      projectId: '',
      stationId: item.stationId === null ? null : typeof item.stationId === 'string' ? item.stationId : null,
      sourceFileId: item.sourceFileId === null ? null : typeof item.sourceFileId === 'string' ? item.sourceFileId : null,
      deviceType: parseHvacDeviceType(item.deviceType, index),
      equipmentName: typeof item.equipmentName === 'string' ? item.equipmentName : '',
      brand: typeof item.brand === 'string' ? item.brand : '',
      model: typeof item.model === 'string' ? item.model : '',
      quantity: parseRequiredNumber(
        item.quantity,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} quantity must be a number.`,
      ),
      ratedPowerKw: parseNullableNumber(
        item.ratedPowerKw,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} ratedPowerKw must be a number or null.`,
      ) ?? null,
      ratedCoolingCapacityKw: parseNullableNumber(
        item.ratedCoolingCapacityKw,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} ratedCoolingCapacityKw must be a number or null.`,
      ) ?? null,
      ratedCop: parseNullableNumber(
        item.ratedCop,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} ratedCop must be a number or null.`,
      ) ?? null,
      frequencyHz: parseNullableNumber(
        item.frequencyHz,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} frequencyHz must be a number or null.`,
      ) ?? null,
      headM: parseNullableNumber(
        item.headM,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} headM must be a number or null.`,
      ) ?? null,
      flowRateM3h: parseNullableNumber(
        item.flowRateM3h,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} flowRateM3h must be a number or null.`,
      ) ?? null,
      heatExchangeCapacityKw: parseNullableNumber(
        item.heatExchangeCapacityKw,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} heatExchangeCapacityKw must be a number or null.`,
      ) ?? null,
      status: item.status === undefined ? 'unknown' : parseEquipmentStatus(item.status, index),
      reviewStatus,
      confidence: parseNullableNumber(
        item.confidence,
        'PROJECT_HVAC_EQUIPMENT_INVALID',
        `HVAC equipment ${index} confidence must be a number or null.`,
      ) ?? null,
      notes: typeof item.notes === 'string' ? item.notes : '',
      createdAt: '',
      updatedAt: '',
    };
  });
}

function parseHvacMonthlyProfiles(value: unknown): ProjectEquipmentMonthlyProfile[] {
  if (!Array.isArray(value)) {
    throw new AppError(400, 'PROJECT_HVAC_MONTHLY_PROFILE_INVALID', 'HVAC monthly profiles must be an array.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(400, 'PROJECT_HVAC_MONTHLY_PROFILE_INVALID', `HVAC monthly profile ${index} must be an object.`);
    }
    const item = entry as Record<string, unknown>;
    const loadRatePct = parseRequiredNumber(
      item.loadRatePct,
      'PROJECT_HVAC_MONTHLY_PROFILE_INVALID',
      `HVAC monthly profile ${index} loadRatePct must be a number.`,
    );

    return {
      id: typeof item.id === 'string' ? item.id : '',
      projectId: '',
      equipmentAssetId: parseRequiredString(
        item.equipmentAssetId,
        'PROJECT_HVAC_MONTHLY_PROFILE_INVALID',
        `HVAC monthly profile ${index} equipmentAssetId is required.`,
      ),
      year: parseRequiredNumber(
        item.year,
        'PROJECT_HVAC_MONTHLY_PROFILE_INVALID',
        `HVAC monthly profile ${index} year must be a number.`,
      ),
      month: parseRequiredNumber(
        item.month,
        'PROJECT_HVAC_MONTHLY_PROFILE_INVALID',
        `HVAC monthly profile ${index} month must be a number.`,
      ),
      runNum: parseRequiredNumber(
        item.runNum,
        'PROJECT_HVAC_MONTHLY_PROFILE_INVALID',
        `HVAC monthly profile ${index} runNum must be a number.`,
      ),
      monthDays: parseRequiredNumber(
        item.monthDays,
        'PROJECT_HVAC_MONTHLY_PROFILE_INVALID',
        `HVAC monthly profile ${index} monthDays must be a number.`,
      ),
      runDays: parseRequiredNumber(
        item.runDays,
        'PROJECT_HVAC_MONTHLY_PROFILE_INVALID',
        `HVAC monthly profile ${index} runDays must be a number.`,
      ),
      runDayHours: parseRequiredNumber(
        item.runDayHours,
        'PROJECT_HVAC_MONTHLY_PROFILE_INVALID',
        `HVAC monthly profile ${index} runDayHours must be a number.`,
      ),
      loadRatePct: loadRatePct > 0 && loadRatePct <= 1 ? loadRatePct * 100 : loadRatePct,
      operationStrategy: item.operationStrategy === undefined
        ? 'partial_year'
        : parseHvacOperationStrategy(item.operationStrategy, index),
      createdAt: '',
      updatedAt: '',
    };
  });
}

function parseRunHvacEvaluation(value: Record<string, unknown>): RunHvacEvaluationInput {
  return {
    year: parseRequiredNumber(
      value.year,
      'PROJECT_HVAC_EVALUATION_INVALID',
      'HVAC evaluation year must be a number.',
    ),
    savingMode: parseHvacSavingMode(value.savingMode),
    electricityPricePerKwh: parseNullableNumber(
      value.electricityPricePerKwh,
      'PROJECT_HVAC_EVALUATION_INVALID',
      'HVAC evaluation electricityPricePerKwh must be a number or null.',
    ),
  };
}

export function registerProjectRoutes(app: FastifyInstance) {
  const service = new ProjectService(app.projectRepo);

  app.register(async (instance) => {
    instance.addHook('preHandler', instance.requireAuth);

    instance.post('/v1/projects', async (request) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.createProject(
        {
          leadId: parseRequiredString(
            body.leadId,
            'PROJECT_LEAD_ID_REQUIRED',
            'Lead id is required.',
          ),
          name: typeof body.name === 'string' ? body.name : undefined,
        },
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.post('/v1/projects/survey-bootstrap', async (request) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const enterpriseId = typeof body.enterpriseId === 'string' ? body.enterpriseId : undefined;
      const item = await service.createSurveyProjectFromEnterprise(
        enterpriseId,
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.get('/v1/projects', async (request) => {
      const query = (request.query ?? {}) as Record<string, unknown>;
      const phase = parsePhase(query.phase);
      const items = await service.listProjectsWithFilters(
        phase ? { phase } : {},
      );
      return { items };
    });

    instance.get('/v1/projects/:projectId', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.getProjectById(params.projectId ?? '');
      return { item };
    });

    instance.patch('/v1/projects/:projectId', async (request) => {
      const params = request.params as { projectId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.updateProject(
        params.projectId ?? '',
        {
          name: parseOptionalString(body.name, 'PROJECT_NAME_INVALID', 'Project name must be a string.'),
          priority: parseOptionalPriority(body.priority),
          workflowStatus: parseOptionalWorkflowStatus(body.workflowStatus),
          assignedTo: parseNullableString(
            body.assignedTo,
            'PROJECT_ASSIGNED_TO_INVALID',
            'Assigned to must be a string or null.',
          ),
          opportunityScore: parseOptionalNumber(
            body.opportunityScore,
            'PROJECT_OPPORTUNITY_SCORE_INVALID',
            'Opportunity score must be a number.',
          ),
          riskSummary: parseOptionalString(
            body.riskSummary,
            'PROJECT_RISK_SUMMARY_INVALID',
            'Risk summary must be a string.',
          ),
        },
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.patch('/v1/projects/:projectId/stages/:stageCode', async (request) => {
      const params = request.params as { projectId?: string; stageCode?: string };
      const item = await service.updateProjectStage(
        params.projectId ?? '',
        parsePhase(params.stageCode) ?? 'prospecting',
        {
          status: parseOptionalStageStatus((request.body as Record<string, unknown> | undefined)?.status),
          ownerUserId: parseNullableString(
            (request.body as Record<string, unknown> | undefined)?.ownerUserId,
            'PROJECT_STAGE_OWNER_INVALID',
            'Owner user id must be a string or null.',
          ),
          approverUserId: parseNullableString(
            (request.body as Record<string, unknown> | undefined)?.approverUserId,
            'PROJECT_STAGE_APPROVER_INVALID',
            'Approver user id must be a string or null.',
          ),
          dueAt: parseNullableString(
            (request.body as Record<string, unknown> | undefined)?.dueAt,
            'PROJECT_STAGE_DUE_AT_INVALID',
            'Due at must be a string or null.',
          ),
          blockers: parseOptionalBlockers((request.body as Record<string, unknown> | undefined)?.blockers),
          collaboratorUserIds: parseOptionalStringArray(
            (request.body as Record<string, unknown> | undefined)?.collaboratorUserIds,
            'PROJECT_STAGE_COLLABORATORS_INVALID',
            'Collaborator user ids must be a string array.',
          ),
          pendingHandoffs: parseOptionalStringArray(
            (request.body as Record<string, unknown> | undefined)?.pendingHandoffs,
            'PROJECT_STAGE_HANDOFFS_INVALID',
            'Pending handoffs must be a string array.',
          ),
          nextGateLabel: parseOptionalString(
            (request.body as Record<string, unknown> | undefined)?.nextGateLabel,
            'PROJECT_STAGE_NEXT_GATE_INVALID',
            'Next gate label must be a string.',
          ),
        },
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.get('/v1/projects/:projectId/audit', async (request) => {
      const params = request.params as { projectId?: string };
      const items = await service.getProjectAudit(params.projectId ?? '');
      return { items };
    });

    instance.get('/v1/projects/:projectId/survey-workspace', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.getProjectSurveyWorkspace(params.projectId ?? '');
      return { item };
    });

    instance.patch('/v1/projects/:projectId/survey-workspace', async (request) => {
      const params = request.params as { projectId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.updateProjectSurveyWorkspace(
        params.projectId ?? '',
        {
          infoCollection: parseSurveyInfoCollection(body.infoCollection),
          surveyRecord: parseSurveyRecord(body.surveyRecord),
          equipmentLedger: parseEquipmentLedger(body.equipmentLedger),
          dataGaps: parseDataGaps(body.dataGaps),
          handoffs: parseHandoffs(body.handoffs),
        },
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.post('/v1/projects/:projectId/survey-complete', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.completeProjectSurveyWorkspace(
        params.projectId ?? '',
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.get('/v1/projects/:projectId/hvac-survey', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.getProjectHvacSurveyWorkspace(params.projectId ?? '');
      return { item };
    });

    instance.post('/v1/projects/:projectId/hvac-survey/stations', async (request) => {
      const params = request.params as { projectId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.upsertCoolingStation(
        params.projectId ?? '',
        parseCoolingStationInput(body),
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.patch('/v1/projects/:projectId/hvac-survey/stations/:stationId', async (request) => {
      const params = request.params as { projectId?: string; stationId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.upsertCoolingStation(
        params.projectId ?? '',
        parseCoolingStationInput(body, params.stationId ?? ''),
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.delete('/v1/projects/:projectId/hvac-survey/stations/:stationId', async (request) => {
      const params = request.params as { projectId?: string; stationId?: string };
      const item = await service.deleteCoolingStation(
        params.projectId ?? '',
        params.stationId ?? '',
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.post('/v1/projects/:projectId/hvac-survey/files', async (request) => {
      const params = request.params as { projectId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.createSurveyFile(
        params.projectId ?? '',
        parseSurveyFileInput(body),
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.post('/v1/projects/:projectId/hvac-survey/files/:fileId/review', async (request) => {
      const params = request.params as { projectId?: string; fileId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.reviewSurveyFile(
        params.projectId ?? '',
        params.fileId ?? '',
        parseSurveyFileReviewInput(body),
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.put('/v1/projects/:projectId/hvac-survey/equipment-assets', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.upsertHvacEquipmentAssets(
        params.projectId ?? '',
        parseHvacEquipmentAssets(request.body),
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.put('/v1/projects/:projectId/hvac-survey/monthly-profiles', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.replaceMonthlyProfiles(
        params.projectId ?? '',
        parseHvacMonthlyProfiles(request.body),
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.post('/v1/projects/:projectId/hvac-survey/evaluation/run', async (request) => {
      const params = request.params as { projectId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.runHvacEvaluation(
        params.projectId ?? '',
        parseRunHvacEvaluation(body),
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.get('/v1/projects/:projectId/solution-workspace', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.getProjectSolutionWorkspace(params.projectId ?? '');
      return { item };
    });

    instance.patch('/v1/projects/:projectId/solution-workspace', async (request) => {
      const params = request.params as { projectId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.updateProjectSolutionWorkspace(
        params.projectId ?? '',
        {
          technicalAssumptions: parseSolutionTechnicalAssumptions(body.technicalAssumptions),
          commercialBranching: parseSolutionCommercialBranching(body.commercialBranching),
        },
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.get('/v1/projects/:projectId/solution-snapshots', async (request) => {
      const params = request.params as { projectId?: string };
      const items = await service.listProjectSolutionSnapshots(params.projectId ?? '');
      return { items };
    });

    instance.post('/v1/projects/:projectId/solution-snapshots', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.createProjectSolutionSnapshot(
        params.projectId ?? '',
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.post('/v1/projects/:projectId/solution-freeze-request', async (request) => {
      const params = request.params as { projectId?: string };
      const item = await service.requestProjectSolutionFreeze(
        params.projectId ?? '',
        request.auth.userId ?? '',
      );
      return { item };
    });

    instance.post('/v1/projects/:projectId/solution-freeze-decision', async (request) => {
      const params = request.params as { projectId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.decideProjectSolutionFreeze(
        params.projectId ?? '',
        parseSolutionFreezeDecision(body.action),
        request.auth.userId ?? '',
        parseOptionalString(
          body.comment,
          'PROJECT_SOLUTION_FREEZE_COMMENT_INVALID',
          'Solution freeze comment must be a string.',
        ),
      );
      return { item };
    });
  });
}
