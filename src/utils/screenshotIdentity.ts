import type { CaptureResult, ScanDetection } from '../types/pipeline.ts';

export function getScreenshotIdentity(
  item: Pick<CaptureResult, 'filename' | 'screenshotId'> | Pick<ScanDetection, 'screenshotFilename' | 'screenshotId'>,
): string {
  if (item.screenshotId) {
    return item.screenshotId;
  }

  return 'filename' in item ? item.filename : item.screenshotFilename;
}

export function isDetectionForScreenshot(
  detection: Pick<ScanDetection, 'screenshotFilename' | 'screenshotId'>,
  screenshot: Pick<CaptureResult, 'filename' | 'screenshotId'>,
): boolean {
  return getScreenshotIdentity(detection) === getScreenshotIdentity(screenshot);
}
