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

export function findDetectionForScreenshot(
  detections: ScanDetection[],
  screenshot: Pick<CaptureResult, 'filename' | 'screenshotId'>,
): ScanDetection | undefined {
  const screenshotIdentity = getScreenshotIdentity(screenshot);
  const matches = detections.filter((detection) => getScreenshotIdentity(detection) === screenshotIdentity);

  for (let index = matches.length - 1; index >= 0; index--) {
    if (!matches[index].error) {
      return matches[index];
    }
  }

  return matches.length > 0 ? matches[matches.length - 1] : undefined;
}
