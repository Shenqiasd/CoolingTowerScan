export interface DetectionBoxInput {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  center_x: number;
  center_y: number;
  width: number;
  height: number;
  confidence: number;
  class_name: string;
}

export interface DetectionResultInput {
  has_cooling_tower: boolean;
  count: number;
  confidence: number;
  detections: DetectionBoxInput[];
}

export interface PersistDetectionInput {
  screenshotId: string;
  enterpriseId: string | null;
  result: DetectionResultInput;
}

export interface PersistDetectionResult {
  screenshotId: string;
  status: 'detected' | 'no_result';
  hasCoolingTower: boolean;
  count: number;
  confidence: number;
  enterpriseId: string | null;
  candidateId: string | null;
  candidateStatus: 'under_review' | 'approved' | null;
  detectionRowCount: number;
  evidenceCount: number;
}

export interface DetectionPersistenceRepo {
  persistDetectionResult(input: PersistDetectionInput): Promise<PersistDetectionResult>;
}
