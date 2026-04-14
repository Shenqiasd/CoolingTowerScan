export const CANDIDATE_STATUSES = [
  'new',
  'under_review',
  'approved',
  'rejected',
  'needs_info',
  'converted',
] as const;

export type CandidateStatus = typeof CANDIDATE_STATUSES[number];

export const CANDIDATE_REVIEW_ACTIONS = [
  'approve',
  'reject',
  'needs_info',
] as const;

export type CandidateReviewAction = typeof CANDIDATE_REVIEW_ACTIONS[number];

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

export type CandidateDuplicateReason =
  | 'enterprise_id'
  | 'site_id'
  | 'enterprise_name'
  | 'address_similarity';

export interface CandidateDuplicateItem extends CandidateListItem {
  siteId: string | null;
  enterpriseId: string | null;
  updatedAt: string;
  duplicateReasons: CandidateDuplicateReason[];
}

export interface CandidateListFilters {
  status?: CandidateStatus;
  search?: string;
}

export interface CandidateReviewInput {
  action: CandidateReviewAction;
  note: string;
}

export interface CandidateMaterializationResult {
  sessionId: string;
  actorUserId: string;
  candidateCount: number;
  evidenceCount: number;
}

export interface CandidateMaterializationInput {
  sessionId: string;
  actorUserId: string;
}

export interface CandidateDedupeInput {
  targetCandidateId: string;
  note: string;
}

export interface CandidateRepo {
  listCandidates(filters: CandidateListFilters): Promise<CandidateListItem[]>;
  getCandidateById(candidateId: string): Promise<CandidateDetail | null>;
  listDuplicateCandidates(candidateId: string): Promise<CandidateDuplicateItem[]>;
  reviewCandidate(
    candidateId: string,
    action: CandidateReviewAction,
    note: string,
    actorUserId: string,
  ): Promise<CandidateDetail | null>;
  dedupeCandidate(
    candidateId: string,
    input: CandidateDedupeInput,
    actorUserId: string,
  ): Promise<CandidateDetail | null>;
  materializeFromScanSession(
    sessionId: string,
    actorUserId: string,
  ): Promise<CandidateMaterializationResult>;
}
