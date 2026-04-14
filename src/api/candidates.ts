import { apiRequest } from './client';

export type CandidateStatus =
  | 'new'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_info'
  | 'converted';

export type CandidateReviewAction = 'approve' | 'reject' | 'needs_info';

export interface CandidateEvidence {
  id: string;
  kind: string;
  screenshotId: string | null;
  detectionResultId: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
}

export interface CandidateListItem {
  id: string;
  candidateCode: string;
  status: CandidateStatus;
  matchedEnterpriseName: string;
  matchedAddress: string;
  coolingTowerCount: number;
  confidenceScore: number;
  createdAt: string;
}

export interface CandidateDetail extends CandidateListItem {
  siteId: string | null;
  enterpriseId: string | null;
  scanSessionId: string | null;
  reviewNote: string;
  rejectionReason: string;
  hvacEstimateSnapshot: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
  evidences: CandidateEvidence[];
  updatedAt: string;
  lastReviewedBy?: string;
}

export interface CandidateDuplicateItem {
  id: string;
  candidateCode: string;
  matchedEnterpriseName: string;
  matchedAddress: string;
  status: CandidateStatus;
  confidenceScore?: number;
  coolingTowerCount?: number;
  relationType?: string;
  relationScore?: number;
  reason?: string;
}

function buildQuery(filters: { status?: CandidateStatus; search?: string }) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.search) {
    params.set('search', filters.search);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function listCandidates(filters: { status?: CandidateStatus; search?: string } = {}) {
  const response = await apiRequest<{ items: CandidateListItem[] }>(`/v1/candidates${buildQuery(filters)}`);
  return response.items;
}

export async function getCandidate(candidateId: string) {
  const response = await apiRequest<{ item: CandidateDetail }>(`/v1/candidates/${candidateId}`);
  return response.item;
}

export async function reviewCandidate(candidateId: string, input: { action: CandidateReviewAction; note: string }) {
  const response = await apiRequest<{ item: CandidateDetail }>(`/v1/candidates/${candidateId}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.item;
}

export async function listCandidateDuplicates(candidateId: string) {
  const response = await apiRequest<{ items: CandidateDuplicateItem[] }>(`/v1/candidates/${candidateId}/duplicates`);
  return response.items;
}

export async function markCandidateDuplicate(
  candidateId: string,
  input: { targetCandidateId: string; note?: string },
) {
  const response = await apiRequest<{ item: CandidateDetail }>(`/v1/candidates/${candidateId}/dedupe`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.item;
}
