import assert from 'node:assert/strict';
import test from 'node:test';

import type { CaptureResult, ScanDetection, ScanSession } from '../types/pipeline.ts';
import { applyScreenshotsReady } from './scanSession.ts';

const screenshot: CaptureResult = {
  filename: 'stitched_Z18_same.png',
  dataUrl: 'data:image/png;base64,abc',
  publicUrl: null,
  screenshotId: 'shot-new',
  sessionId: 'session-new',
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

test('applyScreenshotsReady clears stale detections from previous runs', () => {
  const prev: ScanSession = {
    sessionId: 'session-old',
    screenshots: [],
    detections: [staleDetection],
    status: 'complete',
  };

  const next = applyScreenshotsReady(prev, [screenshot]);

  assert.deepEqual(next.screenshots, [screenshot]);
  assert.deepEqual(next.detections, []);
  assert.equal(next.sessionId, 'session-new');
  assert.equal(next.status, 'screenshotting');
  assert.equal(next.task?.status, 'capturing');
  assert.equal(next.task?.mode, 'address');
  assert.equal(next.task?.screenshotCount, 1);
});
