import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import { buildHvacSurveyGateValidation } from '../src/modules/projects/project.repo.js';
import type {
  ProjectDetail,
  ProjectAuditLogItem,
  ProjectLeadSnapshot,
  ProjectListItem,
  ProjectRepo,
  ProjectHvacSurveyWorkspace,
  ProjectSolutionSnapshot,
  ProjectSolutionWorkspace,
  ProjectSurveyWorkspace,
} from '../src/modules/projects/project.schemas.js';

const TEST_ENV: AppEnv = {
  host: '127.0.0.1',
  port: 0,
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseJwtSecret: 'test-jwt-secret',
};

const QUALIFIED_LEAD: ProjectLeadSnapshot = {
  id: 'lead-1',
  enterpriseId: 'enterprise-1',
  siteId: 'site-1',
  name: '长鑫存储技术有限公司',
  status: 'qualified',
  priority: 'high',
  confirmations: [
    { role: 'sales', status: 'confirmed' },
    { role: 'technical', status: 'confirmed' },
  ],
};

const PROJECT_LIST_ITEM: ProjectListItem = {
  id: 'project-1',
  projectCode: 'PROJ-20260413-0001',
  name: '合肥长鑫一期节能改造',
  leadId: 'lead-1',
  enterpriseId: 'enterprise-1',
  siteId: 'site-1',
  currentPhase: 'prospecting',
  workflowStatus: 'active',
  priority: 'high',
  assignedTo: 'sales-owner-1',
  opportunityScore: 82,
  riskSummary: '业主预算口径尚未锁定',
  currentStageCode: 'prospecting',
  currentStageStatus: 'in_progress',
  currentStageOwnerUserId: 'sales-owner-1',
  currentStageApproverUserId: 'tech-owner-1',
  currentStageDueAt: '2026-04-20T09:00:00.000Z',
  currentStageBlockersCount: 1,
  currentStagePendingHandoffsCount: 1,
  currentStageNextGateLabel: '完成现场初判',
  commercialBranchType: 'epc',
  commercialFreezeReady: true,
  solutionCanSnapshot: true,
  solutionGateErrorCount: 0,
  lastSolutionSnapshotVersion: 1,
  createdAt: '2026-04-13T12:00:00.000Z',
  updatedAt: '2026-04-13T12:00:00.000Z',
} as ProjectListItem;

const PROJECT_DETAIL: ProjectDetail = {
  ...PROJECT_LIST_ITEM,
  stages: [
    {
      stageCode: 'prospecting',
      status: 'in_progress',
      ownerUserId: null,
      approverUserId: null,
      enteredAt: '2026-04-13T12:00:00.000Z',
      dueAt: '2026-04-20T09:00:00.000Z',
      completedAt: null,
      blockers: ['等待现场联系人确认'],
      gateSnapshot: {
        collaboratorUserIds: ['sales-owner-1', 'tech-owner-1'],
        pendingHandoffs: ['同步客户节能边界条件'],
        nextGateLabel: '完成现场初判',
      },
    },
    {
      stageCode: 'qualification',
      status: 'not_started',
      ownerUserId: null,
      approverUserId: null,
      enteredAt: null,
      dueAt: null,
      completedAt: null,
      blockers: [],
      gateSnapshot: {},
    },
    {
      stageCode: 'proposal',
      status: 'in_progress',
      ownerUserId: 'solution-owner-1',
      approverUserId: 'approver-user-1',
      enteredAt: '2026-04-14T12:00:00.000Z',
      dueAt: '2026-04-20T09:00:00.000Z',
      completedAt: null,
      blockers: [],
      gateSnapshot: {
        nextGateLabel: '冻结方案并提交商务审批',
      },
    },
  ],
} as ProjectDetail;

const PROJECT_AUDIT: ProjectAuditLogItem[] = [
  {
    id: 'audit-1',
    entityType: 'project',
    entityId: 'project-1',
    action: 'project.updated',
    actorUserId: 'pm-user-1',
    actorSource: 'api',
    payload: {
      priority: 'high',
      riskSummary: '业主预算口径尚未锁定',
    },
    createdAt: '2026-04-13T12:30:00.000Z',
  },
];

const PROJECT_SURVEY_WORKSPACE: ProjectSurveyWorkspace = {
  projectId: 'project-1',
  infoCollection: {
    siteContactName: '张工',
    siteContactPhone: '13800138000',
    siteAccessWindow: '工作日 09:00-18:00',
    operatingSchedule: '7x24h',
    coolingSystemType: '开式冷却塔 + 冷冻站',
    powerAccessStatus: '配电房可进入',
    waterTreatmentStatus: '有水处理记录',
    notes: '业主希望先做一期示范点',
  },
  surveyRecord: {
    surveyDate: '2026-04-14T09:00:00.000Z',
    surveyOwnerUserId: 'survey-owner-1',
    participantNames: ['张工', '李工'],
    onSiteFindings: '冷却塔老化明显，补水和风机能耗偏高。',
    loadProfileSummary: '夏季高峰明显，夜间负荷偏低。',
    retrofitConstraints: '白天不能长时间停机。',
    nextActions: '补采运行曲线和补水数据。',
  },
  equipmentLedger: [
    {
      id: 'eq-1',
      equipmentName: '冷却塔 1#',
      equipmentType: 'cooling_tower',
      locationLabel: '厂房北侧',
      quantity: 1,
      capacityRt: 500,
      status: 'running',
      notes: '风机皮带磨损',
    },
  ],
  dataGaps: [
    {
      id: 'gap-1',
      stageCode: 'survey',
      gapType: 'risk',
      title: '补水数据缺口',
      detail: '需业主补充近三个月补水台账',
      status: 'open',
      ownerUserId: 'survey-owner-1',
      dueAt: '2026-04-20T09:00:00.000Z',
      waiverReason: '',
    },
  ],
  handoffs: [
    {
      id: 'handoff-1',
      fromStage: 'survey',
      toStage: 'proposal',
      title: '调研结果交接方案组',
      detail: '附上现场照片、设备清单、运行约束',
      status: 'ready',
      ownerUserId: 'survey-owner-1',
      dueAt: '2026-04-18T09:00:00.000Z',
      payload: {
        attachments: ['survey-pack-v1'],
      },
    },
  ],
  gateValidation: {
    canComplete: true,
    errors: [],
  },
  completionStatus: 'draft',
  completedAt: null,
};

const INVALID_PROJECT_SURVEY_WORKSPACE: ProjectSurveyWorkspace = {
  ...PROJECT_SURVEY_WORKSPACE,
  infoCollection: {
    ...PROJECT_SURVEY_WORKSPACE.infoCollection,
    siteContactName: '',
    siteContactPhone: '',
    siteAccessWindow: '',
  },
  surveyRecord: {
    ...PROJECT_SURVEY_WORKSPACE.surveyRecord,
    surveyDate: null,
    surveyOwnerUserId: null,
    onSiteFindings: '',
  },
  equipmentLedger: [],
  dataGaps: [
    {
      id: 'gap-missing-1',
      stageCode: 'survey',
      gapType: 'missing_info',
      title: '运行电参缺失',
      detail: '未拿到冷冻机组运行电流曲线',
      status: 'open',
      ownerUserId: 'survey-owner-1',
      dueAt: '2026-04-21T09:00:00.000Z',
      waiverReason: '',
    },
  ],
  handoffs: [],
  gateValidation: {
    canComplete: false,
    errors: [
      'siteContactName is required',
      'siteContactPhone is required',
      'siteAccessWindow is required',
      'surveyDate is required',
      'surveyOwnerUserId is required',
      'onSiteFindings is required',
      'at least one equipment ledger item is required',
      'open missing_info gaps must be resolved or waived',
      'survey to proposal handoff is required',
    ],
  },
};

const PROJECT_HVAC_SURVEY_WORKSPACE: ProjectHvacSurveyWorkspace = {
  projectId: 'project-1',
  stations: [
    {
      id: 'station-1',
      projectId: 'project-1',
      name: '1# 冷冻站',
      locationLabel: '动力站一层',
      notes: '一期示范冷站',
      createdAt: '2026-04-14T09:00:00.000Z',
      updatedAt: '2026-04-14T09:00:00.000Z',
    },
  ],
  files: [],
  equipmentAssets: [],
  operationRecords: [],
  monthlyProfiles: [],
  latestEvaluation: null,
  gateValidation: {
    canComplete: false,
    errors: ['approved HVAC equipment is required'],
  },
};

const PROJECT_HVAC_APPROVED_ASSET = {
  id: 'asset-1',
  projectId: 'project-1',
  stationId: 'station-1',
  sourceFileId: null,
  deviceType: 'cooling_tower',
  equipmentName: '冷却塔 1#',
  brand: 'BAC',
  model: 'CT-500',
  quantity: 1,
  ratedPowerKw: 30,
  ratedCoolingCapacityKw: null,
  ratedCop: null,
  frequencyHz: 50,
  headM: null,
  flowRateM3h: null,
  heatExchangeCapacityKw: 1800,
  status: 'running',
  reviewStatus: 'approved',
  confidence: 0.92,
  notes: '',
  createdAt: '2026-04-14T09:00:00.000Z',
  updatedAt: '2026-04-14T09:00:00.000Z',
} as const;

const PROJECT_HVAC_MONTHLY_PROFILES = Array.from({ length: 12 }, (_, index) => ({
  id: `profile-${index + 1}`,
  projectId: 'project-1',
  equipmentAssetId: 'asset-1',
  year: 2026,
  month: index + 1,
  runNum: 1,
  monthDays: 30,
  runDays: 20,
  runDayHours: 10,
  loadRatePct: 75,
  operationStrategy: 'partial_year',
  createdAt: '2026-04-14T09:00:00.000Z',
  updatedAt: '2026-04-14T09:00:00.000Z',
})) as ProjectHvacSurveyWorkspace['monthlyProfiles'];

const PROJECT_HVAC_READY_SURVEY_WORKSPACE: ProjectHvacSurveyWorkspace = {
  ...PROJECT_HVAC_SURVEY_WORKSPACE,
  equipmentAssets: [PROJECT_HVAC_APPROVED_ASSET],
  monthlyProfiles: PROJECT_HVAC_MONTHLY_PROFILES,
  gateValidation: {
    canComplete: true,
    errors: [],
  },
};

const PROJECT_SOLUTION_WORKSPACE: ProjectSolutionWorkspace = {
  projectId: 'project-1',
  technicalAssumptions: {
    baselineLoadRt: 1200,
    targetLoadRt: 1000,
    operatingHoursPerYear: 4200,
    electricityPricePerKwh: 0.82,
    baselineCop: 4.2,
    targetCop: 5.6,
    systemLossFactor: 1.08,
  },
  commercialBranching: {
    branchType: 'epc',
    branchDecisionNote: '先采用 EPC 总包交付',
    freezeReady: true,
    epc: {
      capexCny: 2600000,
      grossMarginRate: 0.18,
      deliveryMonths: 6,
    },
    emc: {
      sharedSavingRate: null,
      contractYears: null,
      guaranteedSavingRate: null,
    },
  },
  commercialFreezeApproval: {
    status: 'idle',
    requestedAt: null,
    requestedBy: null,
    requestedSnapshotVersion: null,
    requestedBranchType: null,
    decidedAt: null,
    decidedBy: null,
    decisionComment: '',
  },
  calculationSummary: {
    baselineAnnualEnergyKwh: 4558032,
    targetAnnualEnergyKwh: 2848770,
    annualPowerSavingKwh: 1709262,
    annualCostSavingCny: 1401594.84,
    efficiencyImprovementRatio: 0.38,
    baselineCoolingPowerKw: 1004.86,
    targetCoolingPowerKw: 628.04,
  },
  gateValidation: {
    canSnapshot: true,
    errors: [],
  },
  lastSnapshotVersion: 0,
  lastSnapshotAt: null,
};

const INVALID_PROJECT_SOLUTION_WORKSPACE: ProjectSolutionWorkspace = {
  ...PROJECT_SOLUTION_WORKSPACE,
  technicalAssumptions: {
    baselineLoadRt: 800,
    targetLoadRt: 900,
    operatingHoursPerYear: 0,
    electricityPricePerKwh: 0,
    baselineCop: 4.8,
    targetCop: 4.2,
    systemLossFactor: 0,
  },
  calculationSummary: {
    baselineAnnualEnergyKwh: 0,
    targetAnnualEnergyKwh: 0,
    annualPowerSavingKwh: 0,
    annualCostSavingCny: 0,
    efficiencyImprovementRatio: 0,
    baselineCoolingPowerKw: 0,
    targetCoolingPowerKw: 0,
  },
  commercialBranching: {
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
  },
  commercialFreezeApproval: {
    status: 'idle',
    requestedAt: null,
    requestedBy: null,
    requestedSnapshotVersion: null,
    requestedBranchType: null,
    decidedAt: null,
    decidedBy: null,
    decisionComment: '',
  },
  gateValidation: {
    canSnapshot: false,
    errors: [
      'operatingHoursPerYear must be greater than 0',
      'electricityPricePerKwh must be greater than 0',
      'systemLossFactor must be greater than 0',
      'targetLoadRt must be less than or equal to baselineLoadRt',
      'targetCop must be greater than baselineCop',
      'target annual energy must be lower than baseline annual energy',
      'commercial branchType is required',
    ],
  },
};

const PROJECT_SOLUTION_SNAPSHOT: ProjectSolutionSnapshot = {
  id: 'snapshot-1',
  projectId: 'project-1',
  stageCode: 'proposal',
  versionNo: 1,
  snapshotPayload: {
    technicalAssumptions: PROJECT_SOLUTION_WORKSPACE.technicalAssumptions,
    commercialBranching: PROJECT_SOLUTION_WORKSPACE.commercialBranching,
  },
  calculationSummary: PROJECT_SOLUTION_WORKSPACE.calculationSummary,
  gateErrors: [],
  createdBy: 'pm-user-1',
  createdAt: '2026-04-14T12:30:00.000Z',
};

async function createToken(userId: string) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(TEST_ENV.supabaseJwtSecret ?? ''));
}

function createRepo(
  leadSnapshot: ProjectLeadSnapshot | null = QUALIFIED_LEAD,
): ProjectRepo {
  return {
    getLeadSnapshot: vi.fn(async () => leadSnapshot),
    getProjectByLeadId: vi.fn(async () => null),
    getProjectById: vi.fn(async () => PROJECT_DETAIL),
    createProjectFromLead: vi.fn(async (
      leadId: string,
      name: string,
      actorUserId: string,
    ) => ({
      ...PROJECT_DETAIL,
      leadId,
      name,
      createdBy: actorUserId,
    })),
    listProjects: vi.fn(async () => [PROJECT_LIST_ITEM]),
    updateProject: vi.fn(async () => PROJECT_DETAIL),
    updateProjectStage: vi.fn(async () => PROJECT_DETAIL),
    getProjectAudit: vi.fn(async () => PROJECT_AUDIT),
    getProjectSurveyWorkspace: vi.fn(async () => PROJECT_SURVEY_WORKSPACE),
    getProjectHvacSurveyWorkspace: vi.fn(async () => PROJECT_HVAC_READY_SURVEY_WORKSPACE),
    upsertCoolingStation: vi.fn(async () => PROJECT_HVAC_READY_SURVEY_WORKSPACE),
    deleteCoolingStation: vi.fn(async () => PROJECT_HVAC_READY_SURVEY_WORKSPACE),
    upsertHvacEquipmentAssets: vi.fn(async () => PROJECT_HVAC_READY_SURVEY_WORKSPACE),
    replaceMonthlyProfiles: vi.fn(async () => PROJECT_HVAC_READY_SURVEY_WORKSPACE),
    runHvacEvaluation: vi.fn(async () => PROJECT_HVAC_READY_SURVEY_WORKSPACE),
    updateProjectSurveyWorkspace: vi.fn(async () => PROJECT_SURVEY_WORKSPACE),
    completeProjectSurveyWorkspace: vi.fn(async () => PROJECT_SURVEY_WORKSPACE),
    getProjectSolutionWorkspace: vi.fn(async () => PROJECT_SOLUTION_WORKSPACE),
    updateProjectSolutionWorkspace: vi.fn(async () => PROJECT_SOLUTION_WORKSPACE),
    requestProjectSolutionFreeze: vi.fn(async () => ({
      ...PROJECT_SOLUTION_WORKSPACE,
      commercialFreezeApproval: {
        status: 'pending_approval',
        requestedAt: '2026-04-15T10:00:00.000Z',
        requestedBy: 'pm-user-1',
        requestedSnapshotVersion: 2,
        requestedBranchType: 'epc',
        decidedAt: null,
        decidedBy: null,
        decisionComment: '',
      },
      lastSnapshotVersion: 2,
      lastSnapshotAt: '2026-04-15T10:00:00.000Z',
    })),
    decideProjectSolutionFreeze: vi.fn(async (_projectId, decision) => ({
      ...PROJECT_SOLUTION_WORKSPACE,
      commercialFreezeApproval: {
        status: decision === 'approve' ? 'approved' : 'rejected',
        requestedAt: '2026-04-15T10:00:00.000Z',
        requestedBy: 'pm-user-1',
        requestedSnapshotVersion: 2,
        requestedBranchType: 'epc',
        decidedAt: '2026-04-15T11:00:00.000Z',
        decidedBy: 'approver-user-1',
        decisionComment: '',
      },
      lastSnapshotVersion: 2,
      lastSnapshotAt: '2026-04-15T10:00:00.000Z',
    })),
    createProjectSolutionSnapshot: vi.fn(async () => PROJECT_SOLUTION_SNAPSHOT),
  } as unknown as ProjectRepo;
}

describe('project routes', () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('keeps the HVAC survey workspace contract explicit', () => {
    expect(PROJECT_HVAC_SURVEY_WORKSPACE.stations[0]?.name).toBe('1# 冷冻站');
    expect(PROJECT_HVAC_SURVEY_WORKSPACE.files).toEqual([]);
    expect(PROJECT_HVAC_SURVEY_WORKSPACE.equipmentAssets).toEqual([]);
    expect(PROJECT_HVAC_SURVEY_WORKSPACE.monthlyProfiles).toEqual([]);
    expect(PROJECT_HVAC_SURVEY_WORKSPACE.gateValidation.canComplete).toBe(false);
  });

  it('blocks HVAC survey completion until station, approved equipment, monthly model, gaps, and handoff are ready', () => {
    const gate = buildHvacSurveyGateValidation({
      infoCollection: PROJECT_SURVEY_WORKSPACE.infoCollection,
      surveyRecord: PROJECT_SURVEY_WORKSPACE.surveyRecord,
      stations: [],
      equipmentAssets: [
        {
          id: 'asset-unknown',
          projectId: 'project-1',
          stationId: null,
          sourceFileId: null,
          deviceType: 'unknown',
          equipmentName: '未知设备',
          brand: '',
          model: '',
          quantity: 1,
          ratedPowerKw: null,
          ratedCoolingCapacityKw: null,
          ratedCop: null,
          frequencyHz: null,
          headM: null,
          flowRateM3h: null,
          heatExchangeCapacityKw: null,
          status: 'running',
          reviewStatus: 'approved',
          confidence: null,
          notes: '',
          createdAt: '2026-04-14T09:00:00.000Z',
          updatedAt: '2026-04-14T09:00:00.000Z',
        },
      ],
      monthlyProfiles: [],
      dataGaps: [
        {
          id: 'gap-missing-1',
          stageCode: 'survey',
          gapType: 'missing_info',
          title: '运行电参缺失',
          detail: '',
          status: 'open',
          ownerUserId: null,
          dueAt: null,
          waiverReason: '',
        },
      ],
      handoffs: [
        {
          id: 'handoff-pending',
          fromStage: 'survey',
          toStage: 'proposal',
          title: '交接方案',
          detail: '',
          status: 'pending',
          ownerUserId: null,
          dueAt: null,
          payload: {},
        },
      ],
    });

    expect(gate.canComplete).toBe(false);
    expect(gate.errors).toContain('at least one cooling station is required');
    expect(gate.errors).toContain('equipment 未知设备 deviceType must be known');
    expect(gate.errors).toContain('equipment 未知设备 model is required');
    expect(gate.errors).toContain('equipment 未知设备 ratedPowerKw must be greater than 0');
    expect(gate.errors).toContain('equipment 未知设备 requires 12 monthly profiles');
    expect(gate.errors).toContain('open missing_info gaps must be resolved or waived');
    expect(gate.errors).toContain('survey to proposal handoff is required');
  });

  it('allows HVAC survey completion when approved assets have a complete 12 month model', () => {
    const gate = buildHvacSurveyGateValidation({
      infoCollection: PROJECT_SURVEY_WORKSPACE.infoCollection,
      surveyRecord: PROJECT_SURVEY_WORKSPACE.surveyRecord,
      stations: PROJECT_HVAC_SURVEY_WORKSPACE.stations,
      equipmentAssets: [
        {
          id: 'asset-1',
          projectId: 'project-1',
          stationId: 'station-1',
          sourceFileId: null,
          deviceType: 'cooling_tower',
          equipmentName: '冷却塔 1#',
          brand: 'BAC',
          model: 'CT-500',
          quantity: 1,
          ratedPowerKw: 30,
          ratedCoolingCapacityKw: null,
          ratedCop: null,
          frequencyHz: 50,
          headM: null,
          flowRateM3h: null,
          heatExchangeCapacityKw: 1800,
          status: 'running',
          reviewStatus: 'approved',
          confidence: 0.92,
          notes: '',
          createdAt: '2026-04-14T09:00:00.000Z',
          updatedAt: '2026-04-14T09:00:00.000Z',
        },
      ],
      monthlyProfiles: Array.from({ length: 12 }, (_, index) => ({
        id: `profile-${index + 1}`,
        projectId: 'project-1',
        equipmentAssetId: 'asset-1',
        year: 2026,
        month: index + 1,
        runNum: 1,
        monthDays: 30,
        runDays: 20,
        runDayHours: 10,
        loadRatePct: 75,
        operationStrategy: 'partial_year',
        createdAt: '2026-04-14T09:00:00.000Z',
        updatedAt: '2026-04-14T09:00:00.000Z',
      })),
      dataGaps: PROJECT_SURVEY_WORKSPACE.dataGaps,
      handoffs: PROJECT_SURVEY_WORKSPACE.handoffs,
    });

    expect(gate).toEqual({
      canComplete: true,
      errors: [],
    });
  });

  it('rejects unauthenticated project creation', async () => {
    app = buildApp({
      env: TEST_ENV,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      payload: {
        leadId: 'lead-1',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
        details: {},
      },
    });
  });

  it('creates a project only from a dual-confirmed lead', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        leadId: 'lead-1',
        name: '合肥长鑫一期节能改造',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      item: {
        ...PROJECT_DETAIL,
        createdBy: 'pm-user-1',
      },
    });
    expect(repo.getLeadSnapshot).toHaveBeenCalledWith('lead-1');
    expect(repo.createProjectFromLead).toHaveBeenCalledWith(
      'lead-1',
      '合肥长鑫一期节能改造',
      'pm-user-1',
    );
  });

  it('blocks project creation when the lead is not dual-confirmed', async () => {
    const repo = createRepo({
      ...QUALIFIED_LEAD,
      status: 'pending_confirmation',
      confirmations: [
        { role: 'sales', status: 'confirmed' },
        { role: 'technical', status: 'pending' },
      ],
    });
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        leadId: 'lead-1',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'LEAD_NOT_QUALIFIED',
        message: 'Lead requires both sales and technical confirmation.',
        details: {},
      },
    });
  });

  it('returns 404 when the source lead does not exist', async () => {
    const repo = createRepo(null);
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        leadId: 'missing-lead',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found.',
        details: {},
      },
    });
  });

  it('returns project list for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [PROJECT_LIST_ITEM],
    });
    expect(repo.listProjects).toHaveBeenCalledWith();
  });

  it('supports project list phase filtering', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects?phase=prospecting',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repo.listProjects).toHaveBeenCalledWith({
      phase: 'prospecting',
    });
    expect(response.json()).toEqual({
      items: [PROJECT_LIST_ITEM],
    });
  });

  it('returns project detail for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects/project-1',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repo.getProjectById).toHaveBeenCalledWith('project-1');
    expect(response.json()).toEqual({
      item: PROJECT_DETAIL,
    });
  });

  it('updates project operating fields for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/projects/project-1',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: '合肥长鑫一期节能改造项目',
        priority: 'medium',
        workflowStatus: 'blocked',
        assignedTo: 'ops-owner-2',
        opportunityScore: 74,
        riskSummary: '等待业主确定预算窗口',
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { updateProject: ReturnType<typeof vi.fn> }).updateProject).toHaveBeenCalledWith(
      'project-1',
      {
        name: '合肥长鑫一期节能改造项目',
        priority: 'medium',
        workflowStatus: 'blocked',
        assignedTo: 'ops-owner-2',
        opportunityScore: 74,
        riskSummary: '等待业主确定预算窗口',
      },
      'pm-user-1',
    );
    expect(response.json()).toEqual({
      item: PROJECT_DETAIL,
    });
  });

  it('updates project stage operating fields and passes actor context', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/projects/project-1/stages/qualification',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        status: 'in_progress',
        ownerUserId: 'sales-owner-2',
        approverUserId: 'tech-owner-2',
        dueAt: '2026-04-21T09:00:00.000Z',
        blockers: ['等待客户上传配电资料'],
        collaboratorUserIds: ['sales-owner-2', 'tech-owner-2'],
        pendingHandoffs: ['转交踏勘任务给售前工程师'],
        nextGateLabel: '完成技术初筛',
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { updateProjectStage: ReturnType<typeof vi.fn> }).updateProjectStage).toHaveBeenCalledWith(
      'project-1',
      'qualification',
      {
        status: 'in_progress',
        ownerUserId: 'sales-owner-2',
        approverUserId: 'tech-owner-2',
        dueAt: '2026-04-21T09:00:00.000Z',
        blockers: ['等待客户上传配电资料'],
        collaboratorUserIds: ['sales-owner-2', 'tech-owner-2'],
        pendingHandoffs: ['转交踏勘任务给售前工程师'],
        nextGateLabel: '完成技术初筛',
      },
      'pm-user-1',
    );
    expect(response.json()).toEqual({
      item: PROJECT_DETAIL,
    });
  });

  it('returns project audit trail for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects/project-1/audit',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { getProjectAudit: ReturnType<typeof vi.fn> }).getProjectAudit).toHaveBeenCalledWith('project-1');
    expect(response.json()).toEqual({
      items: PROJECT_AUDIT,
    });
  });

  it('returns survey workspace for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects/project-1/survey-workspace',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { getProjectSurveyWorkspace: ReturnType<typeof vi.fn> }).getProjectSurveyWorkspace)
      .toHaveBeenCalledWith('project-1');
    expect(response.json()).toEqual({
      item: PROJECT_SURVEY_WORKSPACE,
    });
  });

  it('updates survey workspace for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/projects/project-1/survey-workspace',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        infoCollection: PROJECT_SURVEY_WORKSPACE.infoCollection,
        surveyRecord: PROJECT_SURVEY_WORKSPACE.surveyRecord,
        equipmentLedger: PROJECT_SURVEY_WORKSPACE.equipmentLedger,
        dataGaps: PROJECT_SURVEY_WORKSPACE.dataGaps,
        handoffs: PROJECT_SURVEY_WORKSPACE.handoffs,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { updateProjectSurveyWorkspace: ReturnType<typeof vi.fn> }).updateProjectSurveyWorkspace)
      .toHaveBeenCalledWith(
        'project-1',
        {
          infoCollection: PROJECT_SURVEY_WORKSPACE.infoCollection,
          surveyRecord: PROJECT_SURVEY_WORKSPACE.surveyRecord,
          equipmentLedger: PROJECT_SURVEY_WORKSPACE.equipmentLedger,
          dataGaps: PROJECT_SURVEY_WORKSPACE.dataGaps,
          handoffs: PROJECT_SURVEY_WORKSPACE.handoffs,
        },
        'pm-user-1',
      );
    expect(response.json()).toEqual({
      item: PROJECT_SURVEY_WORKSPACE,
    });
  });

  it('completes survey workspace only when validation passes', async () => {
    const repo = createRepo();
    (repo as unknown as { completeProjectSurveyWorkspace: ReturnType<typeof vi.fn> }).completeProjectSurveyWorkspace
      .mockResolvedValueOnce(PROJECT_SURVEY_WORKSPACE);

    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/survey-complete',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { getProjectHvacSurveyWorkspace: ReturnType<typeof vi.fn> }).getProjectHvacSurveyWorkspace)
      .toHaveBeenCalledWith('project-1');
    expect((repo as unknown as { completeProjectSurveyWorkspace: ReturnType<typeof vi.fn> }).completeProjectSurveyWorkspace)
      .toHaveBeenCalledWith('project-1', 'pm-user-1');
    expect(response.json()).toEqual({
      item: PROJECT_SURVEY_WORKSPACE,
    });
  });

  it('blocks survey completion when validation fails', async () => {
    const repo = createRepo();
    (repo as unknown as { getProjectSurveyWorkspace: ReturnType<typeof vi.fn> }).getProjectSurveyWorkspace
      .mockResolvedValueOnce(INVALID_PROJECT_SURVEY_WORKSPACE);

    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/survey-complete',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect((repo as unknown as { completeProjectSurveyWorkspace: ReturnType<typeof vi.fn> }).completeProjectSurveyWorkspace)
      .not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      error: {
        code: 'PROJECT_SURVEY_VALIDATION_FAILED',
        message: 'Survey workspace is not ready to complete.',
        details: {
          errors: INVALID_PROJECT_SURVEY_WORKSPACE.gateValidation.errors,
        },
      },
    });
  });

  it('blocks survey completion when HVAC survey validation fails', async () => {
    const repo = createRepo();
    (repo as unknown as { getProjectHvacSurveyWorkspace: ReturnType<typeof vi.fn> }).getProjectHvacSurveyWorkspace
      .mockResolvedValueOnce(PROJECT_HVAC_SURVEY_WORKSPACE);

    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/survey-complete',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect((repo as unknown as { completeProjectSurveyWorkspace: ReturnType<typeof vi.fn> }).completeProjectSurveyWorkspace)
      .not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      error: {
        code: 'PROJECT_HVAC_SURVEY_VALIDATION_FAILED',
        message: 'HVAC survey workspace is not ready to complete.',
        details: {
          errors: PROJECT_HVAC_SURVEY_WORKSPACE.gateValidation.errors,
        },
      },
    });
  });

  it('returns HVAC survey workspace for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects/project-1/hvac-survey',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { getProjectHvacSurveyWorkspace: ReturnType<typeof vi.fn> }).getProjectHvacSurveyWorkspace)
      .toHaveBeenCalledWith('project-1');
    expect(response.json()).toEqual({
      item: PROJECT_HVAC_READY_SURVEY_WORKSPACE,
    });
  });

  it('creates HVAC cooling stations for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/hvac-survey/stations',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: '2# 冷冻站',
        locationLabel: '动力站二层',
        notes: '二期扩展',
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { upsertCoolingStation: ReturnType<typeof vi.fn> }).upsertCoolingStation)
      .toHaveBeenCalledWith(
        'project-1',
        {
          id: undefined,
          name: '2# 冷冻站',
          locationLabel: '动力站二层',
          notes: '二期扩展',
        },
        'pm-user-1',
      );
    expect(response.json()).toEqual({
      item: PROJECT_HVAC_READY_SURVEY_WORKSPACE,
    });
  });

  it('updates HVAC cooling stations for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/projects/project-1/hvac-survey/stations/station-1',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: '1# 冷冻站',
        locationLabel: '动力站一层',
        notes: '已复核',
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { upsertCoolingStation: ReturnType<typeof vi.fn> }).upsertCoolingStation)
      .toHaveBeenCalledWith(
        'project-1',
        {
          id: 'station-1',
          name: '1# 冷冻站',
          locationLabel: '动力站一层',
          notes: '已复核',
        },
        'pm-user-1',
      );
  });

  it('deletes HVAC cooling stations for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/projects/project-1/hvac-survey/stations/station-1',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { deleteCoolingStation: ReturnType<typeof vi.fn> }).deleteCoolingStation)
      .toHaveBeenCalledWith('project-1', 'station-1', 'pm-user-1');
  });

  it('replaces reviewed HVAC equipment assets for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/projects/project-1/hvac-survey/equipment-assets',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: [
        {
          id: 'asset-1',
          stationId: 'station-1',
          deviceType: 'cooling_tower',
          equipmentName: '冷却塔 1#',
          brand: 'BAC',
          model: 'CT-500',
          quantity: 1,
          ratedPowerKw: 30,
          frequencyHz: 50,
          heatExchangeCapacityKw: 1800,
          status: 'running',
          reviewStatus: 'approved',
          confidence: 0.92,
          notes: '',
        },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { upsertHvacEquipmentAssets: ReturnType<typeof vi.fn> }).upsertHvacEquipmentAssets)
      .toHaveBeenCalledWith(
        'project-1',
        [
          {
            ...PROJECT_HVAC_APPROVED_ASSET,
            projectId: '',
            createdAt: '',
            updatedAt: '',
          },
        ],
        'pm-user-1',
      );
  });

  it('replaces HVAC monthly profiles for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/projects/project-1/hvac-survey/monthly-profiles',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: PROJECT_HVAC_MONTHLY_PROFILES.slice(0, 2).map(({ createdAt, projectId, updatedAt, ...item }) => item),
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { replaceMonthlyProfiles: ReturnType<typeof vi.fn> }).replaceMonthlyProfiles)
      .toHaveBeenCalledWith(
        'project-1',
        PROJECT_HVAC_MONTHLY_PROFILES.slice(0, 2).map((item) => ({
          ...item,
          projectId: '',
          createdAt: '',
          updatedAt: '',
        })),
        'pm-user-1',
      );
  });

  it('runs HVAC saving evaluation for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/hvac-survey/evaluation/run',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        year: 2026,
        savingMode: 'balanced',
        electricityPricePerKwh: 0.82,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { runHvacEvaluation: ReturnType<typeof vi.fn> }).runHvacEvaluation)
      .toHaveBeenCalledWith(
        'project-1',
        {
          year: 2026,
          savingMode: 'balanced',
          electricityPricePerKwh: 0.82,
        },
        'pm-user-1',
      );
  });

  it('returns solution workspace for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects/project-1/solution-workspace',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { getProjectSolutionWorkspace: ReturnType<typeof vi.fn> }).getProjectSolutionWorkspace)
      .toHaveBeenCalledWith('project-1');
    expect(response.json()).toEqual({
      item: PROJECT_SOLUTION_WORKSPACE,
    });
  });

  it('updates solution workspace for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/projects/project-1/solution-workspace',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        technicalAssumptions: PROJECT_SOLUTION_WORKSPACE.technicalAssumptions,
        commercialBranching: PROJECT_SOLUTION_WORKSPACE.commercialBranching,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { updateProjectSolutionWorkspace: ReturnType<typeof vi.fn> }).updateProjectSolutionWorkspace)
      .toHaveBeenCalledWith(
        'project-1',
        {
          technicalAssumptions: PROJECT_SOLUTION_WORKSPACE.technicalAssumptions,
          commercialBranching: PROJECT_SOLUTION_WORKSPACE.commercialBranching,
        },
        'pm-user-1',
      );
    expect(response.json()).toEqual({
      item: PROJECT_SOLUTION_WORKSPACE,
    });
  });

  it('creates a solution snapshot when gate validation passes', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/solution-snapshots',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { createProjectSolutionSnapshot: ReturnType<typeof vi.fn> }).createProjectSolutionSnapshot)
      .toHaveBeenCalledWith('project-1', 'pm-user-1');
    expect(response.json()).toEqual({
      item: PROJECT_SOLUTION_SNAPSHOT,
    });
  });

  it('blocks solution workspace updates while freeze approval is pending', async () => {
    const repo = createRepo();
    (repo as unknown as { getProjectSolutionWorkspace: ReturnType<typeof vi.fn> }).getProjectSolutionWorkspace
      .mockResolvedValueOnce({
        ...PROJECT_SOLUTION_WORKSPACE,
        commercialFreezeApproval: {
          status: 'pending_approval',
          requestedAt: '2026-04-15T10:00:00.000Z',
          requestedBy: 'pm-user-1',
          requestedSnapshotVersion: 2,
          requestedBranchType: 'epc',
          decidedAt: null,
          decidedBy: null,
          decisionComment: '',
        },
      });

    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/projects/project-1/solution-workspace',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        technicalAssumptions: {
          ...PROJECT_SOLUTION_WORKSPACE.technicalAssumptions,
          baselineLoadRt: 820,
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect((repo as unknown as { updateProjectSolutionWorkspace: ReturnType<typeof vi.fn> }).updateProjectSolutionWorkspace)
      .not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      error: {
        code: 'PROJECT_SOLUTION_FREEZE_LOCKED',
        message: 'Solution workspace is locked while freeze approval is pending.',
        details: {},
      },
    });
  });

  it('blocks solution snapshot creation when calculator gate validation fails', async () => {
    const repo = createRepo();
    (repo as unknown as { getProjectSolutionWorkspace: ReturnType<typeof vi.fn> }).getProjectSolutionWorkspace
      .mockResolvedValueOnce(INVALID_PROJECT_SOLUTION_WORKSPACE);

    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/solution-snapshots',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect((repo as unknown as { createProjectSolutionSnapshot: ReturnType<typeof vi.fn> }).createProjectSolutionSnapshot)
      .not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      error: {
        code: 'PROJECT_SOLUTION_VALIDATION_FAILED',
        message: 'Solution workspace is not ready to snapshot.',
        details: {
          errors: INVALID_PROJECT_SOLUTION_WORKSPACE.gateValidation.errors,
        },
      },
    });
  });

  it('requests solution freeze approval after gate validation passes', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/solution-freeze-request',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { requestProjectSolutionFreeze: ReturnType<typeof vi.fn> }).requestProjectSolutionFreeze)
      .toHaveBeenCalledWith('project-1', 'pm-user-1');
    expect(response.json()).toEqual({
      item: {
        ...PROJECT_SOLUTION_WORKSPACE,
        commercialFreezeApproval: {
          status: 'pending_approval',
          requestedAt: '2026-04-15T10:00:00.000Z',
          requestedBy: 'pm-user-1',
          requestedSnapshotVersion: 2,
          requestedBranchType: 'epc',
          decidedAt: null,
          decidedBy: null,
          decisionComment: '',
        },
        lastSnapshotVersion: 2,
        lastSnapshotAt: '2026-04-15T10:00:00.000Z',
      },
    });
  });

  it('blocks solution freeze request when proposal approver is missing', async () => {
    const repo = createRepo();
    (repo as unknown as { getProjectById: ReturnType<typeof vi.fn> }).getProjectById.mockResolvedValueOnce({
      ...PROJECT_DETAIL,
      stages: PROJECT_DETAIL.stages.map((stage) => (
        stage.stageCode === 'proposal'
          ? { ...stage, approverUserId: null }
          : stage
      )),
    });

    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('pm-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/solution-freeze-request',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect((repo as unknown as { requestProjectSolutionFreeze: ReturnType<typeof vi.fn> }).requestProjectSolutionFreeze)
      .not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      error: {
        code: 'PROJECT_SOLUTION_FREEZE_APPROVER_REQUIRED',
        message: 'Proposal stage approver is required before requesting freeze approval.',
        details: {},
      },
    });
  });

  it('records solution freeze approval decisions', async () => {
    const repo = createRepo();
    (repo as unknown as { getProjectSolutionWorkspace: ReturnType<typeof vi.fn> }).getProjectSolutionWorkspace
      .mockResolvedValueOnce({
        ...PROJECT_SOLUTION_WORKSPACE,
        commercialFreezeApproval: {
          status: 'pending_approval',
          requestedAt: '2026-04-15T10:00:00.000Z',
          requestedBy: 'pm-user-1',
          requestedSnapshotVersion: 2,
          requestedBranchType: 'epc',
          decidedAt: null,
          decidedBy: null,
          decisionComment: '',
        },
      });

    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('approver-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/solution-freeze-decision',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        action: 'approve',
      },
    });

    expect(response.statusCode).toBe(200);
    expect((repo as unknown as { decideProjectSolutionFreeze: ReturnType<typeof vi.fn> }).decideProjectSolutionFreeze)
      .toHaveBeenCalledWith('project-1', 'approve', 'approver-user-1', undefined);
    expect(response.json()).toEqual({
      item: {
        ...PROJECT_SOLUTION_WORKSPACE,
        commercialFreezeApproval: {
          status: 'approved',
          requestedAt: '2026-04-15T10:00:00.000Z',
          requestedBy: 'pm-user-1',
          requestedSnapshotVersion: 2,
          requestedBranchType: 'epc',
          decidedAt: '2026-04-15T11:00:00.000Z',
          decidedBy: 'approver-user-1',
          decisionComment: '',
        },
        lastSnapshotVersion: 2,
        lastSnapshotAt: '2026-04-15T10:00:00.000Z',
      },
    });
  });

  it('blocks solution freeze decisions from non-approver users', async () => {
    const repo = createRepo();
    (repo as unknown as { getProjectSolutionWorkspace: ReturnType<typeof vi.fn> }).getProjectSolutionWorkspace
      .mockResolvedValueOnce({
        ...PROJECT_SOLUTION_WORKSPACE,
        commercialFreezeApproval: {
          status: 'pending_approval',
          requestedAt: '2026-04-15T10:00:00.000Z',
          requestedBy: 'pm-user-1',
          requestedSnapshotVersion: 2,
          requestedBranchType: 'epc',
          decidedAt: null,
          decidedBy: null,
          decisionComment: '',
        },
      });

    app = buildApp({
      env: TEST_ENV,
      projectRepo: repo,
    });

    const token = await createToken('other-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/project-1/solution-freeze-decision',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        action: 'reject',
      },
    });

    expect(response.statusCode).toBe(403);
    expect((repo as unknown as { decideProjectSolutionFreeze: ReturnType<typeof vi.fn> }).decideProjectSolutionFreeze)
      .not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      error: {
        code: 'PROJECT_SOLUTION_FREEZE_APPROVER_ONLY',
        message: 'Only the proposal stage approver can decide solution freeze approval.',
        details: {},
      },
    });
  });
});
