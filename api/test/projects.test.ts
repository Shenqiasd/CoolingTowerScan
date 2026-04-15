import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import type {
  ProjectDetail,
  ProjectAuditLogItem,
  ProjectLeadSnapshot,
  ProjectListItem,
  ProjectRepo,
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
    freezeReady: false,
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
    .sign(new TextEncoder().encode(TEST_ENV.supabaseJwtSecret));
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
    updateProjectSurveyWorkspace: vi.fn(async () => PROJECT_SURVEY_WORKSPACE),
    completeProjectSurveyWorkspace: vi.fn(async () => PROJECT_SURVEY_WORKSPACE),
    getProjectSolutionWorkspace: vi.fn(async () => PROJECT_SOLUTION_WORKSPACE),
    updateProjectSolutionWorkspace: vi.fn(async () => PROJECT_SOLUTION_WORKSPACE),
    createProjectSolutionSnapshot: vi.fn(async () => PROJECT_SOLUTION_SNAPSHOT),
  } as unknown as ProjectRepo;
}

describe('project routes', () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
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
});
