import assert from 'node:assert/strict';
import test from 'node:test';

import type { CaptureResult, ScanDetection } from '../types/pipeline.ts';
import { isDetectionForScreenshot } from './screenshotIdentity.ts';

const shot: CaptureResult = {
  filename: 'stitched_Z18_same.png',
  dataUrl: 'data:image/png;base64,abc',
  publicUrl: null,
  screenshotId: 'shot-new',
  row: 0,
  col: 0,
  lng: 121.5,
  lat: 31.2,
  source: 'address',
  addressLabel: '测试地址',
  enterpriseId: null,
};

const staleDetection: ScanDetection = {
  screenshotFilename: 'stitched_Z18_same.png',
  screenshotId: 'shot-old',
  enterpriseId: null,
  lng: 121.5,
  lat: 31.2,
  source: 'address',
  addressLabel: '测试地址',
  hasCoolingTower: false,
  count: 0,
  confidence: 0,
  imageUrl: null,
  dataUrl: null,
  publicUrl: null,
  detections: [],
};

test('isDetectionForScreenshot does not treat same filename with different screenshot ids as the same image', () => {
  assert.equal(isDetectionForScreenshot(staleDetection, shot), false);
});

test('isDetectionForScreenshot falls back to filename when screenshot id is missing', () => {
  const oldStyleShot: CaptureResult = {
    ...shot,
    screenshotId: null,
  };
  const oldStyleDetection: ScanDetection = {
    ...staleDetection,
    screenshotId: null,
  };

  assert.equal(isDetectionForScreenshot(oldStyleDetection, oldStyleShot), true);
});
