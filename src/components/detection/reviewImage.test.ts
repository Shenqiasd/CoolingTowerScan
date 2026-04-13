import assert from 'node:assert/strict';
import test from 'node:test';

import type { CaptureResult, ScanDetection } from '../../types/pipeline.ts';
import {
  getDetectionReviewImageSrc,
  getScreenshotPreviewImageSrc,
} from '../../utils/reviewImage.ts';

const BASE_DETECTION: ScanDetection = {
  screenshotFilename: 'stitched_Z18_test.png',
  screenshotId: 'shot-1',
  enterpriseId: null,
  lng: 121.5,
  lat: 31.2,
  source: 'address',
  addressLabel: 'test',
  hasCoolingTower: true,
  count: 1,
  confidence: 0.92,
  imageUrl: 'https://example.com/original-from-image-url.png',
  dataUrl: null,
  publicUrl: null,
  annotatedUrl: 'https://example.com/annotated.png',
  detections: [],
};

const BASE_SCREENSHOT: CaptureResult = {
  filename: 'stitched_Z18_test.png',
  lat: 31.2,
  lng: 121.5,
  dataUrl: 'data:image/png;base64,abc',
  publicUrl: 'https://example.com/uploaded.png',
  screenshotId: 'shot-1',
  sessionId: 'session-1',
  row: 0,
  col: 0,
  source: 'address',
};

test('getDetectionReviewImageSrc prefers the base image before annotated output', () => {
  assert.equal(
    getDetectionReviewImageSrc({
      ...BASE_DETECTION,
      publicUrl: 'https://example.com/original.png',
      dataUrl: 'data:image/png;base64,detail',
      imageUrl: 'https://example.com/fallback.png',
    }),
    'data:image/png;base64,detail',
  );

  assert.equal(
    getDetectionReviewImageSrc({
      ...BASE_DETECTION,
      dataUrl: null,
      publicUrl: 'https://example.com/original.png',
    }),
    'https://example.com/original.png',
  );

  assert.equal(
    getDetectionReviewImageSrc({
      ...BASE_DETECTION,
      publicUrl: null,
      dataUrl: null,
      imageUrl: null,
    }),
    'https://example.com/annotated.png',
  );
});

test('getScreenshotPreviewImageSrc reuses screenshot thumbnail sources before detection overlays', () => {
  assert.equal(
    getScreenshotPreviewImageSrc(
      {
        ...BASE_SCREENSHOT,
        dataUrl: 'data:image/png;base64,thumb',
        publicUrl: 'https://example.com/shot-public.png',
      },
      {
        ...BASE_DETECTION,
        publicUrl: 'https://example.com/detection-public.png',
        annotatedUrl: 'https://example.com/annotated.png',
      },
    ),
    'data:image/png;base64,thumb',
  );

  assert.equal(
    getScreenshotPreviewImageSrc(
      {
        ...BASE_SCREENSHOT,
        dataUrl: null,
        publicUrl: null,
      },
      {
        ...BASE_DETECTION,
        publicUrl: null,
        imageUrl: 'https://example.com/detection-original.png',
        annotatedUrl: 'https://example.com/annotated.png',
      },
    ),
    'https://example.com/detection-original.png',
  );
});
