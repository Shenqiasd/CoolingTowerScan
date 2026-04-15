import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScanDetection } from '../types/pipeline.ts';
import {
  buildAnnotatedUploadPlan,
  isDetectionReadyForAnnotatedUpload,
} from './annotatedUploadPlan.ts';

function makeDetection(overrides: Partial<ScanDetection> = {}): ScanDetection {
  return {
    screenshotFilename: 'stitched_Z18_test.png',
    screenshotId: 'shot-1',
    enterpriseId: null,
    lng: 121.5,
    lat: 31.2,
    source: 'address',
    addressLabel: 'test',
    hasCoolingTower: true,
    count: 1,
    confidence: 0.8,
    imageUrl: 'https://example.com/original.png',
    publicUrl: 'https://example.com/original.png',
    detections: [
      { class_name: 'cooling_tower', confidence: 0.8, x1: 10, y1: 10, x2: 20, y2: 20 },
    ],
    ...overrides,
  };
}

test('buildAnnotatedUploadPlan classifies missing image sources instead of silently skipping', () => {
  const selected = new Set(['shot-1']);
  const detections = [
    makeDetection({ imageUrl: null, publicUrl: null, dataUrl: null }),
  ];

  const plan = buildAnnotatedUploadPlan(detections, selected);

  assert.equal(plan.ready.length, 0);
  assert.equal(plan.missingImage.length, 1);
  assert.equal(plan.missingImage[0].screenshotId, 'shot-1');
});

test('buildAnnotatedUploadPlan returns upload-ready detections with towers and boxes', () => {
  const selected = new Set(['shot-1']);
  const detections = [makeDetection()];

  const plan = buildAnnotatedUploadPlan(detections, selected);

  assert.equal(plan.ready.length, 1);
  assert.equal(plan.missingImage.length, 0);
  assert.equal(plan.missingBoxes.length, 0);
  assert.equal(plan.alreadyUploaded.length, 0);
});

test('buildAnnotatedUploadPlan keeps area detections in review or binding buckets before upload', () => {
  const detections = [
    makeDetection({
      screenshotId: 'shot-area-review',
      source: 'area',
      candidateStatus: 'under_review',
      reviewStatus: 'pending',
      matchedEnterpriseId: null,
    }),
    makeDetection({
      screenshotId: 'shot-area-binding',
      source: 'area',
      candidateStatus: 'approved',
      reviewStatus: 'confirmed',
      matchedEnterpriseId: null,
    }),
    makeDetection({
      screenshotId: 'shot-area-ready',
      source: 'area',
      candidateStatus: 'approved',
      reviewStatus: 'confirmed',
      matchedEnterpriseId: 'ent-1',
      enterpriseId: 'ent-1',
    }),
    makeDetection({
      screenshotId: 'shot-address-ready',
      source: 'address',
      candidateStatus: 'under_review',
      reviewStatus: 'pending',
      matchedEnterpriseId: null,
    }),
  ];

  const selected = new Set(detections.map((item) => item.screenshotId!));
  const plan = buildAnnotatedUploadPlan(detections, selected);

  assert.deepEqual(plan.ready.map((item) => item.screenshotId), ['shot-area-ready', 'shot-address-ready']);
  assert.deepEqual(plan.needsReview.map((item) => item.screenshotId), ['shot-area-review']);
  assert.deepEqual(plan.needsBinding.map((item) => item.screenshotId), ['shot-area-binding']);
});

test('isDetectionReadyForAnnotatedUpload enforces review-first for area detections only', () => {
  assert.equal(
    isDetectionReadyForAnnotatedUpload(makeDetection({
      source: 'address',
      candidateStatus: 'under_review',
      reviewStatus: 'pending',
      matchedEnterpriseId: null,
    })),
    true,
  );

  assert.equal(
    isDetectionReadyForAnnotatedUpload(makeDetection({
      source: 'area',
      candidateStatus: 'under_review',
      reviewStatus: 'pending',
      matchedEnterpriseId: null,
    })),
    false,
  );

  assert.equal(
    isDetectionReadyForAnnotatedUpload(makeDetection({
      source: 'area',
      candidateStatus: 'approved',
      reviewStatus: 'confirmed',
      matchedEnterpriseId: null,
    })),
    false,
  );

  assert.equal(
    isDetectionReadyForAnnotatedUpload(makeDetection({
      source: 'area',
      candidateStatus: 'approved',
      reviewStatus: 'confirmed',
      matchedEnterpriseId: 'ent-1',
      enterpriseId: 'ent-1',
    })),
    true,
  );
});
