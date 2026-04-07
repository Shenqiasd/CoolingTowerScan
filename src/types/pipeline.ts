import type { CaptureResult } from '../components/screenshot/CaptureEngine';

export type { CaptureResult };
// Backward compat alias
export type ScreenshotResult = CaptureResult;

export type PipelineStep = 'screenshot' | 'detection' | 'results';

export interface ScanDetection {
  screenshotFilename: string;
  lng: number;
  lat: number;
  hasCoolingTower: boolean;
  count: number;
  confidence: number;
  imageUrl: string | null;
  detections: Array<{
    class_name: string;
    confidence: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
}

export interface ScanSession {
  screenshots: CaptureResult[];
  detections: ScanDetection[];
  status: 'idle' | 'screenshotting' | 'detecting' | 'complete';
}

export const INITIAL_SCAN_SESSION: ScanSession = {
  screenshots: [],
  detections: [],
  status: 'idle',
};
