import { AppError } from '../../plugins/errors.js';
import { buildSolutionCalculationResult } from './solution-calculator.js';
import type {
  CreateProjectInput,
  CreateProjectSurveyFileInput,
  ProjectEquipmentMonthlyProfile,
  ProjectHvacEquipmentAsset,
  ProjectHvacSurveyWorkspace,
  ProjectAuditLogItem,
  ProjectListFilters,
  ProjectLeadSnapshot,
  ProjectRepo,
  ProjectSolutionFreezeDecision,
  ProjectSolutionSnapshot,
  ProjectSolutionTechnicalAssumptions,
  ProjectSolutionWorkspace,
  UpdateProjectSurveyWorkspaceInput,
  UpdateProjectSolutionWorkspaceInput,
  ProjectStageCode,
  ProjectSurveyWorkspace,
  ReviewProjectSurveyFileInput,
  RunHvacEvaluationInput,
  UpdateProjectInput,
  UpdateProjectStageInput,
  UpsertCoolingStationInput,
} from './project.schemas.js';

function hasDualConfirmation(lead: ProjectLeadSnapshot) {
  const salesConfirmed = lead.confirmations.some((item) => (
    item.role === 'sales' && item.status === 'confirmed'
  ));
  const technicalConfirmed = lead.confirmations.some((item) => (
    item.role === 'technical' && item.status === 'confirmed'
  ));

  return salesConfirmed && technicalConfirmed;
}

export class ProjectService {
  constructor(private readonly repo: ProjectRepo) {}

  private normalizeSolutionAssumptions(input: ProjectSolutionTechnicalAssumptions) {
    return {
      baselineLoadRt: input.baselineLoadRt ?? 0,
      targetLoadRt: input.targetLoadRt ?? 0,
      operatingHoursPerYear: input.operatingHoursPerYear ?? 0,
      electricityPricePerKwh: input.electricityPricePerKwh ?? 0,
      baselineCop: input.baselineCop ?? 0,
      targetCop: input.targetCop ?? 0,
      systemLossFactor: input.systemLossFactor ?? 0,
    };
  }

  async createProject(input: CreateProjectInput, actorUserId: string) {
    const leadId = input.leadId.trim();
    if (!leadId) {
      throw new AppError(400, 'PROJECT_LEAD_ID_REQUIRED', 'Lead id is required.');
    }

    const lead = await this.repo.getLeadSnapshot(leadId);
    if (!lead) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found.');
    }

    const existing = await this.repo.getProjectByLeadId(leadId);
    if (existing) {
      return existing;
    }

    if (!lead.enterpriseId || !lead.siteId) {
      throw new AppError(409, 'LEAD_PROJECT_SOURCE_INVALID', 'Lead is missing enterprise or site binding.');
    }

    if (lead.status !== 'qualified' || !hasDualConfirmation(lead)) {
      throw new AppError(409, 'LEAD_NOT_QUALIFIED', 'Lead requires both sales and technical confirmation.');
    }

    const name = input.name?.trim() || lead.name;
    const item = await this.repo.createProjectFromLead(leadId, name, actorUserId);
    if (!item) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found.');
    }

    return item;
  }

  async createSurveyProjectFromEnterprise(enterpriseId: string | undefined, actorUserId: string) {
    const normalizedEnterpriseId = enterpriseId?.trim() || undefined;
    const item = await this.repo.createSurveyProjectFromEnterprise(normalizedEnterpriseId, actorUserId);
    if (!item) {
      throw new AppError(404, 'ENTERPRISE_PROJECT_SOURCE_NOT_FOUND', 'No enterprise is available to initialize a survey project.');
    }

    return item;
  }

  async listProjects() {
    return this.repo.listProjects();
  }

  async listProjectsWithFilters(filters: ProjectListFilters) {
    if (!filters.phase) {
      return this.repo.listProjects();
    }

    return this.repo.listProjects(filters);
  }

  async getProjectById(projectId: string) {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.getProjectById(id);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async updateProject(projectId: string, input: UpdateProjectInput, actorUserId: string) {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.updateProject(id, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async updateProjectStage(
    projectId: string,
    stageCode: ProjectStageCode,
    input: UpdateProjectStageInput,
    actorUserId: string,
  ) {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.updateProjectStage(id, stageCode, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async getProjectAudit(projectId: string): Promise<ProjectAuditLogItem[]> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    return this.repo.getProjectAudit(id);
  }

  async getProjectSurveyWorkspace(projectId: string): Promise<ProjectSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.getProjectSurveyWorkspace(id);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async updateProjectSurveyWorkspace(
    projectId: string,
    input: UpdateProjectSurveyWorkspaceInput,
    actorUserId: string,
  ): Promise<ProjectSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.updateProjectSurveyWorkspace(id, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async completeProjectSurveyWorkspace(projectId: string, actorUserId: string): Promise<ProjectSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const hvacWorkspace = await this.repo.getProjectHvacSurveyWorkspace(id);
    if (!hvacWorkspace) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }
    if (!hvacWorkspace.gateValidation.canComplete) {
      throw new AppError(
        409,
        'PROJECT_HVAC_SURVEY_VALIDATION_FAILED',
        'HVAC survey workspace is not ready to complete.',
        {
          errors: hvacWorkspace.gateValidation.errors,
        },
      );
    }

    const item = await this.repo.completeProjectSurveyWorkspace(id, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async getProjectHvacSurveyWorkspace(projectId: string): Promise<ProjectHvacSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.getProjectHvacSurveyWorkspace(id);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async upsertCoolingStation(
    projectId: string,
    input: UpsertCoolingStationInput,
    actorUserId: string,
  ): Promise<ProjectHvacSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.upsertCoolingStation(id, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async deleteCoolingStation(
    projectId: string,
    stationId: string,
    actorUserId: string,
  ): Promise<ProjectHvacSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }
    const targetStationId = stationId.trim();
    if (!targetStationId) {
      throw new AppError(400, 'PROJECT_HVAC_STATION_ID_REQUIRED', 'Cooling station id is required.');
    }

    const item = await this.repo.deleteCoolingStation(id, targetStationId, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async createSurveyFile(
    projectId: string,
    input: CreateProjectSurveyFileInput,
    actorUserId: string,
  ): Promise<ProjectHvacSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.createSurveyFile(id, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async reviewSurveyFile(
    projectId: string,
    fileId: string,
    input: ReviewProjectSurveyFileInput,
    actorUserId: string,
  ): Promise<ProjectHvacSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }
    const targetFileId = fileId.trim();
    if (!targetFileId) {
      throw new AppError(400, 'PROJECT_SURVEY_FILE_ID_REQUIRED', 'Survey file id is required.');
    }

    const item = await this.repo.reviewSurveyFile(id, targetFileId, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async upsertHvacEquipmentAssets(
    projectId: string,
    input: ProjectHvacEquipmentAsset[],
    actorUserId: string,
  ): Promise<ProjectHvacSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.upsertHvacEquipmentAssets(id, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async replaceMonthlyProfiles(
    projectId: string,
    input: ProjectEquipmentMonthlyProfile[],
    actorUserId: string,
  ): Promise<ProjectHvacSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.replaceMonthlyProfiles(id, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async runHvacEvaluation(
    projectId: string,
    input: RunHvacEvaluationInput,
    actorUserId: string,
  ): Promise<ProjectHvacSurveyWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.runHvacEvaluation(id, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async getProjectSolutionWorkspace(projectId: string): Promise<ProjectSolutionWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const item = await this.repo.getProjectSolutionWorkspace(id);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async updateProjectSolutionWorkspace(
    projectId: string,
    input: UpdateProjectSolutionWorkspaceInput,
    actorUserId: string,
  ): Promise<ProjectSolutionWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    if (input.technicalAssumptions) {
      buildSolutionCalculationResult(this.normalizeSolutionAssumptions({
        baselineLoadRt: input.technicalAssumptions.baselineLoadRt ?? null,
        targetLoadRt: input.technicalAssumptions.targetLoadRt ?? null,
        operatingHoursPerYear: input.technicalAssumptions.operatingHoursPerYear ?? null,
        electricityPricePerKwh: input.technicalAssumptions.electricityPricePerKwh ?? null,
        baselineCop: input.technicalAssumptions.baselineCop ?? null,
        targetCop: input.technicalAssumptions.targetCop ?? null,
        systemLossFactor: input.technicalAssumptions.systemLossFactor ?? null,
      }));
    }

    const current = await this.repo.getProjectSolutionWorkspace(id);
    if (!current) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    if (current.commercialFreezeApproval.status === 'pending_approval') {
      throw new AppError(
        409,
        'PROJECT_SOLUTION_FREEZE_LOCKED',
        'Solution workspace is locked while freeze approval is pending.',
      );
    }

    const item = await this.repo.updateProjectSolutionWorkspace(id, input, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async listProjectSolutionSnapshots(projectId: string): Promise<ProjectSolutionSnapshot[]> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    return this.repo.listProjectSolutionSnapshots(id);
  }

  async createProjectSolutionSnapshot(projectId: string, actorUserId: string): Promise<ProjectSolutionSnapshot> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const current = await this.repo.getProjectSolutionWorkspace(id);
    if (!current) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    if (!current.gateValidation.canSnapshot) {
      throw new AppError(
        409,
        'PROJECT_SOLUTION_VALIDATION_FAILED',
        'Solution workspace is not ready to snapshot.',
        {
          errors: current.gateValidation.errors,
        },
      );
    }

    const item = await this.repo.createProjectSolutionSnapshot(id, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async requestProjectSolutionFreeze(projectId: string, actorUserId: string): Promise<ProjectSolutionWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const detail = await this.repo.getProjectById(id);
    if (!detail) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    const proposalStage = detail.stages.find((item) => item.stageCode === 'proposal');
    if (!proposalStage?.approverUserId) {
      throw new AppError(
        409,
        'PROJECT_SOLUTION_FREEZE_APPROVER_REQUIRED',
        'Proposal stage approver is required before requesting freeze approval.',
      );
    }

    const current = await this.repo.getProjectSolutionWorkspace(id);
    if (!current) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    if (!current.gateValidation.canSnapshot) {
      throw new AppError(
        409,
        'PROJECT_SOLUTION_VALIDATION_FAILED',
        'Solution workspace is not ready to request freeze approval.',
        {
          errors: current.gateValidation.errors,
        },
      );
    }

    if (current.commercialFreezeApproval.status === 'pending_approval') {
      throw new AppError(
        409,
        'PROJECT_SOLUTION_FREEZE_ALREADY_PENDING',
        'Solution freeze approval is already pending.',
      );
    }

    const item = await this.repo.requestProjectSolutionFreeze(id, actorUserId);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }

  async decideProjectSolutionFreeze(
    projectId: string,
    decision: ProjectSolutionFreezeDecision,
    actorUserId: string,
    comment?: string,
  ): Promise<ProjectSolutionWorkspace> {
    const id = projectId.trim();
    if (!id) {
      throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required.');
    }

    const current = await this.repo.getProjectSolutionWorkspace(id);
    if (!current) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    if (current.commercialFreezeApproval.status !== 'pending_approval') {
      throw new AppError(
        409,
        'PROJECT_SOLUTION_FREEZE_NOT_PENDING',
        'Solution freeze approval is not pending.',
      );
    }

    const detail = await this.repo.getProjectById(id);
    if (!detail) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    const proposalStage = detail.stages.find((item) => item.stageCode === 'proposal');
    if (!proposalStage?.approverUserId || proposalStage.approverUserId !== actorUserId) {
      throw new AppError(
        403,
        'PROJECT_SOLUTION_FREEZE_APPROVER_ONLY',
        'Only the proposal stage approver can decide solution freeze approval.',
      );
    }

    const item = await this.repo.decideProjectSolutionFreeze(id, decision, actorUserId, comment);
    if (!item) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    }

    return item;
  }
}
