import { AppError } from '../../plugins/errors.js';
import type {
  CreateLeadInput,
  LeadConfirmInput,
  LeadListFilters,
  LeadRepo,
  UpdateLeadInput,
} from './lead.schemas.js';

export class LeadService {
  constructor(private readonly repo: LeadRepo) {}

  async listLeads(filters: LeadListFilters) {
    return this.repo.listLeads(filters);
  }

  async getLeadById(leadId: string) {
    const id = leadId.trim();
    if (!id) {
      throw new AppError(400, 'LEAD_ID_REQUIRED', 'Lead id is required.');
    }

    const item = await this.repo.getLeadById(id);
    if (!item) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found.');
    }

    return item;
  }

  async createLead(input: CreateLeadInput, actorUserId: string) {
    const candidateId = input.candidateId.trim();
    const name = input.name.trim();

    if (!candidateId) {
      throw new AppError(400, 'LEAD_CANDIDATE_ID_REQUIRED', 'Candidate id is required.');
    }

    if (!name) {
      throw new AppError(400, 'LEAD_NAME_REQUIRED', 'Lead name is required.');
    }

    const candidateStatus = await this.repo.getCandidateStatus(candidateId);
    if (!candidateStatus) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    if (candidateStatus !== 'approved') {
      throw new AppError(409, 'CANDIDATE_NOT_APPROVED', 'Candidate must be approved before creating a lead.');
    }

    const item = await this.repo.createLeadFromCandidate(candidateId, name, actorUserId);
    if (!item) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    return item;
  }

  async confirmLead(leadId: string, input: LeadConfirmInput, actorUserId: string) {
    const id = leadId.trim();
    const comment = input.comment.trim();
    if (!id) {
      throw new AppError(400, 'LEAD_ID_REQUIRED', 'Lead id is required.');
    }

    const item = await this.repo.confirmLead(id, input.role, input.action, comment, actorUserId);
    if (!item) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found.');
    }

    return item;
  }

  async updateLead(leadId: string, input: UpdateLeadInput, actorUserId: string) {
    const id = leadId.trim();
    if (!id) {
      throw new AppError(400, 'LEAD_ID_REQUIRED', 'Lead id is required.');
    }

    const item = await this.repo.updateLead(id, {
      priority: input.priority,
      salesOwnerUserId: input.salesOwnerUserId ?? null,
      technicalOwnerUserId: input.technicalOwnerUserId ?? null,
      nextAction: input.nextAction?.trim(),
      riskSummary: input.riskSummary?.trim(),
    }, actorUserId);

    if (!item) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found.');
    }

    return item;
  }

  async listLeadAuditLogs(leadId: string) {
    const id = leadId.trim();
    if (!id) {
      throw new AppError(400, 'LEAD_ID_REQUIRED', 'Lead id is required.');
    }

    await this.getLeadById(id);
    return this.repo.listLeadAuditLogs(id);
  }
}
