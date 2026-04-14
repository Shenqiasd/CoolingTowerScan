import { apiRequest } from './client';

export type LeadStatus =
  | 'new'
  | 'pending_confirmation'
  | 'qualified'
  | 'disqualified'
  | 'on_hold'
  | 'converted';

export type LeadPriority = 'high' | 'medium' | 'low';
export type LeadConfirmationRole = 'sales' | 'technical';
export type LeadConfirmationStatus = 'pending' | 'confirmed' | 'rejected';
export type LeadConfirmAction = 'confirm' | 'reject';

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
  confirmations: LeadConfirmation[];
}

export interface LeadDetail extends LeadListItem {
  qualificationSummary: Record<string, unknown>;
  sourceSnapshot: Record<string, unknown>;
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

function buildLeadQuery(filters: { status?: LeadStatus; priority?: LeadPriority; search?: string }) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.priority) {
    params.set('priority', filters.priority);
  }
  if (filters.search?.trim()) {
    params.set('search', filters.search.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function listLeads(filters: { status?: LeadStatus; priority?: LeadPriority; search?: string } = {}) {
  const response = await apiRequest<{ items: LeadListItem[] }>(`/v1/leads${buildLeadQuery(filters)}`);
  return response.items;
}

export async function getLead(leadId: string) {
  const response = await apiRequest<{ item: LeadDetail }>(`/v1/leads/${leadId}`);
  return response.item;
}

export async function createLead(input: { candidateId: string; name: string }) {
  const response = await apiRequest<{ item: LeadDetail }>('/v1/leads', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.item;
}

export async function confirmLead(
  leadId: string,
  input: { role: LeadConfirmationRole; action: LeadConfirmAction; comment: string },
) {
  const response = await apiRequest<{ item: LeadDetail }>(`/v1/leads/${leadId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.item;
}

export async function updateLead(
  leadId: string,
  input: {
    priority?: LeadPriority;
    salesOwnerUserId?: string | null;
    technicalOwnerUserId?: string | null;
    nextAction?: string;
    riskSummary?: string;
  },
) {
  const response = await apiRequest<{ item: LeadDetail }>(`/v1/leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return response.item;
}

export async function listLeadAuditLogs(leadId: string) {
  const response = await apiRequest<{ items: LeadAuditLogItem[] }>(`/v1/leads/${leadId}/audit`);
  return response.items;
}
