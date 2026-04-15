export const PROJECT_WORKFLOW_STATUSES = [
  'active',
  'blocked',
  'on_hold',
  'completed',
  'cancelled',
] as const;

export type ProjectWorkflowStatus = typeof PROJECT_WORKFLOW_STATUSES[number];

export const PROJECT_STAGE_STATUSES = [
  'not_started',
  'in_progress',
  'blocked',
  'pending_approval',
  'completed',
  'waived',
] as const;

export type ProjectStageStatus = typeof PROJECT_STAGE_STATUSES[number];

export const PROJECT_STAGE_CODES = [
  'prospecting',
  'qualification',
  'survey',
  'proposal',
  'bidding',
  'execution',
  'commissioning',
  'operations',
] as const;

export type ProjectStageCode = typeof PROJECT_STAGE_CODES[number];

export const PROJECT_PRIORITIES = ['high', 'medium', 'low'] as const;

export type ProjectPriority = typeof PROJECT_PRIORITIES[number];

export interface CreateProjectInput {
  leadId: string;
  name?: string;
}

export interface ProjectListFilters {
  phase?: ProjectStageCode;
}

export interface ProjectListItem {
  id: string;
  projectCode: string;
  name: string;
  leadId: string;
  enterpriseId: string;
  siteId: string;
  currentPhase: ProjectStageCode;
  workflowStatus: ProjectWorkflowStatus;
  priority: ProjectPriority;
  assignedTo: string | null;
  opportunityScore: number;
  riskSummary: string;
  currentStageCode: ProjectStageCode;
  currentStageStatus: ProjectStageStatus;
  currentStageOwnerUserId: string | null;
  currentStageApproverUserId: string | null;
  currentStageDueAt: string | null;
  currentStageBlockersCount: number;
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

export interface ProjectStageGateSnapshot extends Record<string, unknown> {
  collaboratorUserIds?: string[];
  pendingHandoffs?: string[];
  nextGateLabel?: string;
}

export interface ProjectStageItem {
  stageCode: ProjectStageCode;
  status: ProjectStageStatus;
  ownerUserId: string | null;
  approverUserId: string | null;
  enteredAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  blockers: unknown[];
  gateSnapshot: ProjectStageGateSnapshot;
}

export interface ProjectDetail extends ProjectListItem {
  stages: ProjectStageItem[];
}

export interface ProjectLeadSnapshot {
  id: string;
  enterpriseId: string;
  siteId: string;
  name: string;
  status: string;
  priority: ProjectPriority;
  confirmations: Array<{
    role: 'sales' | 'technical';
    status: 'pending' | 'confirmed' | 'rejected';
  }>;
}

export interface UpdateProjectInput {
  name?: string;
  priority?: ProjectPriority;
  workflowStatus?: ProjectWorkflowStatus;
  assignedTo?: string | null;
  opportunityScore?: number;
  riskSummary?: string;
}

export interface UpdateProjectStageInput {
  status?: ProjectStageStatus;
  ownerUserId?: string | null;
  approverUserId?: string | null;
  dueAt?: string | null;
  blockers?: unknown[];
  collaboratorUserIds?: string[];
  pendingHandoffs?: string[];
  nextGateLabel?: string;
}

export interface ProjectAuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  actorSource: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectSurveyInfoCollection {
  siteContactName: string;
  siteContactPhone: string;
  siteAccessWindow: string;
  operatingSchedule: string;
  coolingSystemType: string;
  powerAccessStatus: string;
  waterTreatmentStatus: string;
  notes: string;
}

export interface ProjectSurveyRecord {
  surveyDate: string | null;
  surveyOwnerUserId: string | null;
  participantNames: string[];
  onSiteFindings: string;
  loadProfileSummary: string;
  retrofitConstraints: string;
  nextActions: string;
}

export const PROJECT_EQUIPMENT_STATUSES = [
  'unknown',
  'running',
  'standby',
  'offline',
] as const;

export type ProjectEquipmentStatus = typeof PROJECT_EQUIPMENT_STATUSES[number];

export interface ProjectEquipmentLedgerItem {
  id: string;
  equipmentName: string;
  equipmentType: string;
  locationLabel: string;
  quantity: number;
  capacityRt: number;
  status: ProjectEquipmentStatus;
  notes: string;
}

export const PROJECT_DATA_GAP_TYPES = ['missing_info', 'risk', 'waiver'] as const;

export type ProjectDataGapType = typeof PROJECT_DATA_GAP_TYPES[number];

export const PROJECT_DATA_GAP_STATUSES = ['open', 'resolved', 'waived'] as const;

export type ProjectDataGapStatus = typeof PROJECT_DATA_GAP_STATUSES[number];

export interface ProjectDataGapItem {
  id: string;
  stageCode: ProjectStageCode;
  gapType: ProjectDataGapType;
  title: string;
  detail: string;
  status: ProjectDataGapStatus;
  ownerUserId: string | null;
  dueAt: string | null;
  waiverReason: string;
}

export const PROJECT_HANDOFF_STATUSES = ['pending', 'ready', 'completed', 'waived'] as const;

export type ProjectHandoffStatus = typeof PROJECT_HANDOFF_STATUSES[number];

export interface ProjectHandoffItem {
  id: string;
  fromStage: ProjectStageCode;
  toStage: ProjectStageCode;
  title: string;
  detail: string;
  status: ProjectHandoffStatus;
  ownerUserId: string | null;
  dueAt: string | null;
  payload: Record<string, unknown>;
}

export interface ProjectSurveyGateValidation {
  canComplete: boolean;
  errors: string[];
}

export type ProjectSurveyCompletionStatus = 'draft' | 'completed';

export interface ProjectSurveyWorkspace {
  projectId: string;
  infoCollection: ProjectSurveyInfoCollection;
  surveyRecord: ProjectSurveyRecord;
  equipmentLedger: ProjectEquipmentLedgerItem[];
  dataGaps: ProjectDataGapItem[];
  handoffs: ProjectHandoffItem[];
  gateValidation: ProjectSurveyGateValidation;
  completionStatus: ProjectSurveyCompletionStatus;
  completedAt: string | null;
}

export interface UpdateProjectSurveyWorkspaceInput {
  infoCollection?: Partial<ProjectSurveyInfoCollection>;
  surveyRecord?: Partial<ProjectSurveyRecord>;
  equipmentLedger?: ProjectEquipmentLedgerItem[];
  dataGaps?: ProjectDataGapItem[];
  handoffs?: ProjectHandoffItem[];
}

export interface ProjectSolutionTechnicalAssumptions {
  baselineLoadRt: number | null;
  targetLoadRt: number | null;
  operatingHoursPerYear: number | null;
  electricityPricePerKwh: number | null;
  baselineCop: number | null;
  targetCop: number | null;
  systemLossFactor: number | null;
}

export type ProjectCommercialBranchType = 'epc' | 'emc';

export interface ProjectSolutionEpcCommercial {
  capexCny: number | null;
  grossMarginRate: number | null;
  deliveryMonths: number | null;
}

export interface ProjectSolutionEmcCommercial {
  sharedSavingRate: number | null;
  contractYears: number | null;
  guaranteedSavingRate: number | null;
}

export interface ProjectSolutionCommercialBranching {
  branchType: ProjectCommercialBranchType | null;
  branchDecisionNote: string;
  freezeReady: boolean;
  epc: ProjectSolutionEpcCommercial;
  emc: ProjectSolutionEmcCommercial;
}

export const PROJECT_SOLUTION_FREEZE_STATUSES = [
  'idle',
  'pending_approval',
  'approved',
  'rejected',
] as const;

export type ProjectSolutionFreezeStatus = typeof PROJECT_SOLUTION_FREEZE_STATUSES[number];

export const PROJECT_SOLUTION_FREEZE_DECISIONS = [
  'approve',
  'reject',
] as const;

export type ProjectSolutionFreezeDecision = typeof PROJECT_SOLUTION_FREEZE_DECISIONS[number];

export interface ProjectSolutionFreezeApproval {
  status: ProjectSolutionFreezeStatus;
  requestedAt: string | null;
  requestedBy: string | null;
  requestedSnapshotVersion: number | null;
  requestedBranchType: ProjectCommercialBranchType | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionComment: string;
}

export interface ProjectSolutionCalculationSummary {
  baselineAnnualEnergyKwh: number;
  targetAnnualEnergyKwh: number;
  annualPowerSavingKwh: number;
  annualCostSavingCny: number;
  efficiencyImprovementRatio: number;
  baselineCoolingPowerKw: number;
  targetCoolingPowerKw: number;
}

export interface ProjectSolutionGateValidation {
  canSnapshot: boolean;
  errors: string[];
}

export interface ProjectSolutionWorkspace {
  projectId: string;
  technicalAssumptions: ProjectSolutionTechnicalAssumptions;
  commercialBranching: ProjectSolutionCommercialBranching;
  commercialFreezeApproval: ProjectSolutionFreezeApproval;
  calculationSummary: ProjectSolutionCalculationSummary;
  gateValidation: ProjectSolutionGateValidation;
  lastSnapshotVersion: number;
  lastSnapshotAt: string | null;
}

export interface UpdateProjectSolutionWorkspaceInput {
  technicalAssumptions?: Partial<ProjectSolutionTechnicalAssumptions>;
  commercialBranching?: Partial<ProjectSolutionCommercialBranching>;
}

export interface ProjectSolutionSnapshot {
  id: string;
  projectId: string;
  stageCode: ProjectStageCode;
  versionNo: number;
  snapshotPayload: Record<string, unknown>;
  calculationSummary: ProjectSolutionCalculationSummary;
  gateErrors: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface ProjectRepo {
  getLeadSnapshot(leadId: string): Promise<ProjectLeadSnapshot | null>;
  getProjectByLeadId(leadId: string): Promise<ProjectDetail | null>;
  getProjectById(projectId: string): Promise<ProjectDetail | null>;
  createProjectFromLead(leadId: string, name: string, actorUserId: string): Promise<ProjectDetail | null>;
  listProjects(filters?: ProjectListFilters): Promise<ProjectListItem[]>;
  updateProject(projectId: string, input: UpdateProjectInput, actorUserId: string): Promise<ProjectDetail | null>;
  updateProjectStage(
    projectId: string,
    stageCode: ProjectStageCode,
    input: UpdateProjectStageInput,
    actorUserId: string,
  ): Promise<ProjectDetail | null>;
  getProjectAudit(projectId: string): Promise<ProjectAuditLogItem[]>;
  getProjectSurveyWorkspace(projectId: string): Promise<ProjectSurveyWorkspace | null>;
  updateProjectSurveyWorkspace(
    projectId: string,
    input: UpdateProjectSurveyWorkspaceInput,
    actorUserId: string,
  ): Promise<ProjectSurveyWorkspace | null>;
  completeProjectSurveyWorkspace(projectId: string, actorUserId: string): Promise<ProjectSurveyWorkspace | null>;
  getProjectSolutionWorkspace(projectId: string): Promise<ProjectSolutionWorkspace | null>;
  updateProjectSolutionWorkspace(
    projectId: string,
    input: UpdateProjectSolutionWorkspaceInput,
    actorUserId: string,
  ): Promise<ProjectSolutionWorkspace | null>;
  requestProjectSolutionFreeze(
    projectId: string,
    actorUserId: string,
  ): Promise<ProjectSolutionWorkspace | null>;
  decideProjectSolutionFreeze(
    projectId: string,
    decision: ProjectSolutionFreezeDecision,
    actorUserId: string,
    comment?: string,
  ): Promise<ProjectSolutionWorkspace | null>;
  listProjectSolutionSnapshots(projectId: string): Promise<ProjectSolutionSnapshot[]>;
  createProjectSolutionSnapshot(projectId: string, actorUserId: string): Promise<ProjectSolutionSnapshot | null>;
}
