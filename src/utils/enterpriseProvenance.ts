import type { DetectionResult, Enterprise } from '../types/enterprise.ts';

export interface DiscoveryCandidateSnapshot {
  status: string;
  enterprise_id: string | null;
}

export interface DiscoveryFunnelStats {
  totalScanTasks: number;
  pendingReviewCandidates: number;
  approvedCandidates: number;
  rejectedCandidates: number;
  needsBindingCandidates: number;
}

export interface EnterpriseCandidateProvenance {
  id: string;
  candidate_code: string;
  scan_session_id: string | null;
  source_label: string | null;
  source_payload: Record<string, unknown> | null;
  created_at: string | null;
}

export interface EnterpriseProvenance {
  sourceMode: 'address' | 'area' | 'manual' | 'unknown';
  sourceLabel: string;
  scanSessionId: string | null;
  screenshotId: string | null;
  candidateId: string | null;
  candidateCode: string | null;
  candidateCreatedAt: string | null;
  imageUploadedAt: string | null;
  latestDetectionImagePath: string | null;
  latestDetectionCreatedAt: string | null;
}

function isPendingStatus(status: string): boolean {
  return status === 'new' || status === 'under_review' || status === 'needs_info';
}

function isApprovedStatus(status: string): boolean {
  return status === 'approved' || status === 'converted';
}

function resolveSourceMode(value: unknown): EnterpriseProvenance['sourceMode'] {
  if (value === 'address' || value === 'address-upload' || value === 'address_scan_detection') {
    return 'address';
  }
  if (value === 'area' || value === 'area_scan_detection') {
    return 'area';
  }
  if (value === 'manual_upload' || value === 'manual') {
    return 'manual';
  }
  return 'unknown';
}

export function getEnterpriseSourceLabel(details: Record<string, unknown> | null | undefined): string {
  const source = resolveSourceMode(details?.source);
  if (source === 'address') {
    return '地址识别';
  }
  if (source === 'area') {
    return '区域候选';
  }
  if (source === 'manual') {
    return '手工录入';
  }
  return '企业库';
}

export function buildDiscoveryFunnelStats({
  totalScanTasks,
  candidates,
}: {
  totalScanTasks: number;
  candidates: DiscoveryCandidateSnapshot[];
}): DiscoveryFunnelStats {
  return candidates.reduce<DiscoveryFunnelStats>((acc, candidate) => {
    if (isPendingStatus(candidate.status)) {
      acc.pendingReviewCandidates += 1;
    }
    if (isApprovedStatus(candidate.status)) {
      acc.approvedCandidates += 1;
      if (!candidate.enterprise_id) {
        acc.needsBindingCandidates += 1;
      }
    }
    if (candidate.status === 'rejected') {
      acc.rejectedCandidates += 1;
    }
    return acc;
  }, {
    totalScanTasks,
    pendingReviewCandidates: 0,
    approvedCandidates: 0,
    rejectedCandidates: 0,
    needsBindingCandidates: 0,
  });
}

function resolveLatestDetection(detectionResults: DetectionResult[]): DetectionResult | null {
  if (detectionResults.length === 0) {
    return null;
  }

  return [...detectionResults].sort((left, right) => {
    const leftTime = Date.parse(left.created_at);
    const rightTime = Date.parse(right.created_at);
    return rightTime - leftTime;
  })[0] ?? null;
}

export function buildEnterpriseProvenance({
  enterprise,
  candidate,
  detectionResults,
}: {
  enterprise: Enterprise;
  candidate?: EnterpriseCandidateProvenance | null;
  detectionResults: DetectionResult[];
}): EnterpriseProvenance {
  const matchDetails = enterprise.match_dimension_details ?? {};
  const candidatePayload = candidate?.source_payload ?? {};
  const latestDetection = resolveLatestDetection(detectionResults);
  const sourceMode = resolveSourceMode(
    candidatePayload.source
    ?? candidate?.source_label
    ?? matchDetails.source,
  );

  let sourceLabel = '企业库';
  if (sourceMode === 'address') {
    sourceLabel = '地址识别自动建企';
  } else if (sourceMode === 'area') {
    sourceLabel = '区域截图候选';
  } else if (sourceMode === 'manual') {
    sourceLabel = '手工上传';
  }

  const screenshotValue = candidatePayload.screenshotId ?? matchDetails.screenshot_id ?? null;

  return {
    sourceMode,
    sourceLabel,
    scanSessionId: candidate?.scan_session_id ?? null,
    screenshotId: typeof screenshotValue === 'string' && screenshotValue ? screenshotValue : null,
    candidateId: candidate?.id ?? null,
    candidateCode: candidate?.candidate_code ?? null,
    candidateCreatedAt: candidate?.created_at ?? null,
    imageUploadedAt: enterprise.image_uploaded_at ?? null,
    latestDetectionImagePath: latestDetection?.image_path ?? null,
    latestDetectionCreatedAt: latestDetection?.created_at ?? null,
  };
}
