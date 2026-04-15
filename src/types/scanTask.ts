export type ScanTaskMode = 'area' | 'address';

export type ScanTaskStatus =
  | 'draft'
  | 'queued'
  | 'capturing'
  | 'capture_failed'
  | 'detecting'
  | 'review_pending'
  | 'completed'
  | 'partial_failed';

export interface ScanTask {
  id: string | null;
  mode: ScanTaskMode;
  status: ScanTaskStatus;
  screenshotCount: number;
  detectedCount: number;
  reviewedCount: number;
}
