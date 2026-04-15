import type { FastifyInstance } from 'fastify';

import { AppError } from '../plugins/errors.js';
import { ProjectService } from '../modules/projects/project.service.js';
import {
  PROJECT_DATA_GAP_STATUSES,
  PROJECT_DATA_GAP_TYPES,
  PROJECT_EQUIPMENT_STATUSES,
  PROJECT_HANDOFF_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_SOLUTION_FREEZE_DECISIONS,
  PROJECT_STAGE_CODES,
  PROJECT_STAGE_STATUSES,
  PROJECT_WORKFLOW_STATUSES,
  type ProjectDataGapItem,
  type ProjectEquipmentLedgerItem,
  type ProjectHandoffItem,
  type ProjectRepo,
  type ProjectStageCode,
  type ProjectStageStatus,
  type ProjectSolutionTechnicalAssumptions,
  type ProjectSolutionCommercialBranching,
  type ProjectCommercialBranchType,
  type ProjectWorkflowStatus,
  type ProjectSurveyInfoCollection,
  type ProjectSurveyRecord,
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
