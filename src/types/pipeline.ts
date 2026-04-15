import type { CaptureResult } from '../components/screenshot/CaptureEngine';
import type { ScanCandidateStatus } from './scanCandidate';
import type { ScanTask } from './scanTask';

export type { CaptureResult };
// Backward compat alias
export type ScreenshotResult = CaptureResult;

export type PipelineStep = 'screenshot' | 'detection' | 'results';

export interface BboxDetection {
  class_name: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ScanDetection {
  screenshotFilename: string;
  screenshotId: string | null;   // scan_screenshots.id
  enterpriseId?: string | null;  // for enterprise auto-update
  lng: number;
  lat: number;
  source?: 'area' | 'address';  // screenshot origin
  addressLabel?: string;
  resolvedAddress?: string;
  hasCoolingTower: boolean;
  count: number;
  confidence: number;
  imageUrl: string | null;
  dataUrl?: string | null;      // base64 data URL (available before upload)
  publicUrl?: string | null;    // original uploaded URL
  annotatedUrl?: string | null; // annotated image URL (bbox drawn)
  uploadStatus?: 'idle' | 'uploading' | 'done' | 'failed';
  reviewStatus?: 'pending' | 'confirmed' | 'rejected';
  candidateId?: string | null;
  candidateStatus?: ScanCandidateStatus | null;
  matchedEnterpriseId?: string | null;
  error?: string;
  detections: BboxDetection[];
}

export interface DetectionFilters {
  detectionStatus: '' | 'pending' | 'detected' | 'no_result' | 'error';
  hasTower: '' | 'yes' | 'no';
  confidenceMin: number;
  confidenceMax: number;
  source: '' | 'area' | 'address';
  addressLabel: string;
}

export interface ScanSession {
  sessionId: string | null;
  task?: ScanTask | null;
  screenshots: CaptureResult[];
  detections: ScanDetection[];
  status: 'idle' | 'screenshotting' | 'detecting' | 'complete';
}

export const INITIAL_SCAN_SESSION: ScanSession = {
  sessionId: null,
  task: null,
  screenshots: [],
  detections: [],
  status: 'idle',
};
