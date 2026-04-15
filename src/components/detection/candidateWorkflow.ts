import type { ScanDetection } from '../../types/pipeline.ts';

export type CandidateWorkflowState =
  | 'none'
  | 'pending_review'
  | 'approved'
  | 'needs_binding'
  | 'linked'
  | 'rejected';

export interface CandidateWorkflowMeta {
  label: string;
  tone: string;
}

export function getCandidateWorkflowState(detection?: ScanDetection | null): CandidateWorkflowState {
  if (!detection || !detection.hasCoolingTower) {
    return 'none';
  }

  if (detection.reviewStatus === 'rejected' || detection.candidateStatus === 'rejected') {
    return 'rejected';
  }

  if (detection.enterpriseId || detection.matchedEnterpriseId) {
    return 'linked';
  }

  const approved = Boolean(
    detection.reviewStatus === 'confirmed'
    || detection.candidateStatus === 'approved'
    || detection.candidateStatus === 'converted',
  );

  if (detection.source === 'area') {
    return approved ? 'needs_binding' : 'pending_review';
  }

  return approved ? 'approved' : 'pending_review';
}

export function getCandidateWorkflowMeta(state: CandidateWorkflowState): CandidateWorkflowMeta | null {
  switch (state) {
    case 'pending_review':
      return {
        label: '待审核',
        tone: 'bg-amber-500/15 text-amber-300 border border-amber-500/20',
      };
    case 'approved':
      return {
        label: '已通过',
        tone: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
      };
    case 'needs_binding':
      return {
        label: '待绑定企业',
        tone: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20',
      };
    case 'linked':
      return {
        label: '已绑定企业',
        tone: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20',
      };
    case 'rejected':
      return {
        label: '已驳回',
        tone: 'bg-rose-500/15 text-rose-300 border border-rose-500/20',
      };
    default:
      return null;
  }
}
