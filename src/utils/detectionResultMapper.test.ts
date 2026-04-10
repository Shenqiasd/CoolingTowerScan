import assert from 'node:assert/strict';
import test from 'node:test';

import type { CaptureResult } from '../types/pipeline.ts';
import { buildErrorDetection, buildScanDetection } from './detectionResultMapper.ts';

const baseShot: CaptureResult = {
  filename: 'stitched_Z18_test.png',
  dataUrl: 'data:image/png;base64,abc',
  publicUrl: 'https://example.com/original.png',
  screenshotId: 'shot-1',
  row: 0,
  col: 0,
  lng: 121.5,
  lat: 31.2,
  source: 'address',
  addressLabel: '测试企业',
  enterpriseId: 'ent-1',
};

test('buildScanDetection preserves screenshot metadata needed downstream', () => {
  const detection = buildScanDetection(baseShot, {
    has_cooling_tower: true,
    count: 1,
    confidence: 0.82,
    detections: [
      {
        class_name: 'cooling_tower',
        confidence: 0.82,
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 40,
        center_x: 20,
        center_y: 30,
        width: 20,
        height: 20,
      },
    ],
  });

  assert.equal(detection.source, 'address');
  assert.equal(detection.addressLabel, '测试企业');
  assert.equal(detection.enterpriseId, 'ent-1');
  assert.equal(detection.publicUrl, 'https://example.com/original.png');
  assert.equal(detection.detections[0].class_name, 'cooling_tower');
});

test('buildErrorDetection preserves screenshot metadata for failed detections', () => {
  const detection = buildErrorDetection(baseShot, new Error('network down'));

  assert.equal(detection.source, 'address');
  assert.equal(detection.addressLabel, '测试企业');
  assert.equal(detection.error, 'network down');
  assert.equal(detection.hasCoolingTower, false);
  assert.deepEqual(detection.detections, []);
});
