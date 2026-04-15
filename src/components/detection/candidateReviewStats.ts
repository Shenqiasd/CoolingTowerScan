import type { ScanDetection } from '../../types/pipeline.ts';

export interface CandidateReviewStats {
  pendingReview: number;
  approved: number;
  rejected: number;
  needsBinding: number;
}

function isPendingCandidate(detection: ScanDetection): boolean {
  if (!detection.hasCoolingTower) {
    return false;
  }

  return !detection.candidateStatus || detection.candidateStatus === 'new' || detection.candidateStatus === 'under_review' || detection.candidateStatus === 'needs_info';
}

export function buildCandidateReviewStats(detections: ScanDetection[]): CandidateReviewStats {
  return detections.reduce<CandidateReviewStats>((acc, detection) => {
    if (isPendingCandidate(detection)) {
      acc.pendingReview += 1;
    }

    if (detection.candidateStatus === 'approved' || detection.candidateStatus === 'converted') {
      acc.approved += 1;
    }

    if (detection.candidateStatus === 'rejected') {
      acc.rejected += 1;
    }

    if (detection.hasCoolingTower && detection.source === 'area' && !detection.matchedEnterpriseId && detection.candidateStatus !== 'rejected') {
      acc.needsBinding += 1;
    }

    return acc;
  }, {
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    needsBinding: 0,
  });
}
