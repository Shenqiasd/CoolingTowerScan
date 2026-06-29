import assert from 'node:assert/strict';
import test from 'node:test';

import type { CaptureResult, ScanDetection } from '../types/pipeline.ts';
import {
  appendErrorDetectionIfMissing,
  patchDetection,
  upsertDetection,
} from './detectionState.ts';

const BASE_DETECTION: ScanDetection = {
  screenshotFilename: 'stitched_Z18_test.png',
  screenshotId: 'shot-1',
  enterpriseId: null,
  lng: 121.5,
  lat: 31.2,
  source: 'address',
  addressLabel: 'test',
  hasCoolingTower: true,
  count: 3,
  confidence: 0.8,
  imageUrl: 'https://example.com/original.png',
  publicUrl: 'https://example.com/original.png',
  detections: [],
};

test('patchDetection updates matching detection without dropping the array', () => {
  const detections: ScanDetection[] = [
    BASE_DETECTION,
    {
      ...BASE_DETECTION,
      screenshotFilename: 'stitched_Z18_other.png',
      screenshotId: 'shot-2',
    },
  ];

  const updated = patchDetection(detections, BASE_DETECTION, {
    annotatedUrl: 'https://example.com/annotated.png',
    uploadStatus: 'done',
  });

  assert.equal(updated.length, 2);
  assert.equal(updated[0].annotatedUrl, 'https://example.com/annotated.png');
  assert.equal(updated[0].uploadStatus, 'done');
  assert.equal(updated[1].screenshotId, 'shot-2');
});

test('upsertDetection replaces matching detection by screenshot identity', () => {
  const detections: ScanDetection[] = [
    BASE_DETECTION,
    {
      ...BASE_DETECTION,
      screenshotFilename: 'stitched_Z18_other.png',
      screenshotId: 'shot-2',
      confidence: 0.4,
    },
  ];

  const updated = upsertDetection(detections, {
    ...BASE_DETECTION,
    confidence: 0.92,
    count: 8,
  });

  assert.equal(updated.length, 2);
  assert.equal(updated[0].confidence, 0.92);
  assert.equal(updated[0].count, 8);
  assert.equal(updated[1].screenshotId, 'shot-2');
});

test('appendErrorDetectionIfMissing preserves an existing successful detection', () => {
  const screenshot: CaptureResult = {
    filename: BASE_DETECTION.screenshotFilename,
    dataUrl: null,
    publicUrl: BASE_DETECTION.publicUrl ?? null,
    screenshotId: BASE_DETECTION.screenshotId,
    sessionId: 'session-1',
    row: 0,
    col: 0,
    lng: BASE_DETECTION.lng,
    lat: BASE_DETECTION.lat,
    source: 'address',
  };

  const errorDetection: ScanDetection = {
    ...BASE_DETECTION,
    hasCoolingTower: false,
    count: 0,
    confidence: 0,
    error: '检测失败',
    detections: [],
  };

  const updated = appendErrorDetectionIfMissing([BASE_DETECTION], screenshot, errorDetection);

  assert.equal(updated.length, 1);
  assert.equal(updated[0].error, undefined);
  assert.equal(updated[0].hasCoolingTower, true);
});

test('appendErrorDetectionIfMissing appends errors for screenshots with no prior result', () => {
  const screenshot: CaptureResult = {
    filename: 'stitched_Z18_missing.png',
    dataUrl: null,
    publicUrl: null,
    screenshotId: 'shot-missing',
    sessionId: 'session-1',
    row: 0,
    col: 0,
    lng: BASE_DETECTION.lng,
    lat: BASE_DETECTION.lat,
    source: 'address',
  };
  const errorDetection: ScanDetection = {
    ...BASE_DETECTION,
    screenshotFilename: screenshot.filename,
    screenshotId: screenshot.screenshotId,
    hasCoolingTower: false,
    count: 0,
    confidence: 0,
    error: '检测失败',
    detections: [],
  };

  const updated = appendErrorDetectionIfMissing([BASE_DETECTION], screenshot, errorDetection);

  assert.equal(updated.length, 2);
  assert.equal(updated[1].error, '检测失败');
});
