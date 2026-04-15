export type ScanCandidateStatus =
  | 'new'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_info'
  | 'converted';

export interface ScanCandidateRef {
  id: string;
  status: ScanCandidateStatus;
}
