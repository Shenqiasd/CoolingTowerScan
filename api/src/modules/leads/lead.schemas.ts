export const LEAD_STATUSES = [
  'new',
  'pending_confirmation',
  'qualified',
  'disqualified',
  'on_hold',
  'converted',
] as const;

export type LeadStatus = typeof LEAD_STATUSES[number];

export const LEAD_PRIORITIES = [
  'high',
  'medium',
  'low',
] as const;

export type LeadPriority = typeof LEAD_PRIORITIES[number];

export const LEAD_CONFIRMATION_ROLES = [
  'sales',
  'technical',
] as const;

export type LeadConfirmationRole = typeof LEAD_CONFIRMATION_ROLES[number];

export const LEAD_CONFIRM_ACTIONS = [
  'confirm',
  'reject',
] as const;

export type LeadConfirmAction = typeof LEAD_CONFIRM_ACTIONS[number];

export const LEAD_CONFIRMATION_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
] as const;

export type LeadConfirmationStatus = typeof LEAD_CONFIRMATION_STATUSES[number];

export interface LeadConfirmation {
  role: LeadConfirmationRole;
  status: LeadConfirmationStatus;
  comment: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export interface LeadListItem {
  id: string;
  leadCode: string;
  candidateId: string;
  enterpriseId: string;
  siteId: string;
  name: string;
  status: LeadStatus;
  priority: LeadPriority;
  salesOwnerUserId: string | null;
  technicalOwnerUserId: string | null;
  nextAction: string;
  riskSummary: string;
  createdAt: string;
  updatedAt: string;
  confirmations: Array<{
    role: LeadConfirmationRole;
    status: LeadConfirmationStatus;
  }>;
}

export interface LeadDetail {
  id: LeadListItem['id'];
  leadCode: LeadListItem['leadCode'];
  candidateId: LeadListItem['candidateId'];
  enterpriseId: LeadListItem['enterpriseId'];
  siteId: LeadListItem['siteId'];
  name: LeadListItem['name'];
  status: LeadListItem['status'];
  priority: LeadListItem['priority'];
  salesOwnerUserId: LeadListItem['salesOwnerUserId'];
  technicalOwnerUserId: LeadListItem['technicalOwnerUserId'];
  nextAction: LeadListItem['nextAction'];
  riskSummary: LeadListItem['riskSummary'];
  qualificationSummary: Record<string, unknown>;
  sourceSnapshot: Record<string, unknown>;
  createdAt: LeadListItem['createdAt'];
  updatedAt: LeadListItem['updatedAt'];
  confirmations: LeadConfirmation[];
  createdBy?: string;
}

export interface CreateLeadInput {
  candidateId: string;
  name: string;
}

export interface LeadConfirmInput {
  role: LeadConfirmationRole;
  action: LeadConfirmAction;
  comment: string;
}

export interface LeadListFilters {
  status?: LeadStatus;
  priority?: LeadPriority;
  search?: string;
}

export interface UpdateLeadInput {
  priority?: LeadPriority;
  salesOwnerUserId?: string | null;
  technicalOwnerUserId?: string | null;
  nextAction?: string;
  riskSummary?: string;
}

export interface LeadAuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  actorSource: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LeadRepo {
  getCandidateStatus(candidateId: string): Promise<'approved' | 'new' | 'under_review' | 'rejected' | 'needs_info' | 'converted' | null>;
  listLeads(filters: LeadListFilters): Promise<LeadListItem[]>;
  getLeadById(leadId: string): Promise<LeadDetail | null>;
  updateLead(leadId: string, input: UpdateLeadInput, actorUserId: string): Promise<LeadDetail | null>;
  listLeadAuditLogs(leadId: string): Promise<LeadAuditLogItem[]>;
  createLeadFromCandidate(candidateId: string, name: string, actorUserId: string): Promise<LeadDetail | null>;
  confirmLead(
    leadId: string,
    role: LeadConfirmationRole,
    action: LeadConfirmAction,
    comment: string,
    actorUserId: string,
  ): Promise<LeadDetail | null>;
}
