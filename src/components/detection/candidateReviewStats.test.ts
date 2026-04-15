import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCandidateReviewStats } from './candidateReviewStats.ts';
import type { ScanDetection } from '../../types/pipeline.ts';

function makeDetection(input: Partial<ScanDetection>): ScanDetection {
  return {
    screenshotFilename: 'scan.png',
    screenshotId: 'shot-1',
    enterpriseId: null,
    lng: 121.5,
    lat: 31.2,
    hasCoolingTower: true,
    count: 1,
    confidence: 0.8,
    imageUrl: null,
    detections: [],
    ...input,
  };
}

test('buildCandidateReviewStats groups detections by review and binding state', () => {
  const stats = buildCandidateReviewStats([
    makeDetection({ candidateStatus: 'under_review', matchedEnterpriseId: null, source: 'area' }),
    makeDetection({ candidateStatus: 'approved', matchedEnterpriseId: 'ent-1', source: 'area' }),
    makeDetection({ candidateStatus: 'rejected', source: 'area' }),
    makeDetection({ candidateStatus: null, matchedEnterpriseId: null, source: 'area' }),
    makeDetection({ hasCoolingTower: false, count: 0, confidence: 0, source: 'area' }),
  ]);

  assert.deepEqual(stats, {
    pendingReview: 2,
    approved: 1,
    rejected: 1,
    needsBinding: 2,
  });
});
