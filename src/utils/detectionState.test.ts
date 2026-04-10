import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScanDetection } from '../types/pipeline.ts';
import { patchDetection } from './detectionState.ts';

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
