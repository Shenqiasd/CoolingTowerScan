import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScanDetection } from '../../types/pipeline.ts';
import { getCandidateWorkflowState } from './candidateWorkflow.ts';

function makeDetection(input: Partial<ScanDetection>): ScanDetection {
  return {
    screenshotFilename: 'scan.png',
    screenshotId: 'shot-1',
    enterpriseId: null,
    lng: 121.5,
    lat: 31.2,
    source: 'area',
    hasCoolingTower: true,
    count: 1,
    confidence: 0.8,
    imageUrl: null,
    detections: [],
    ...input,
  };
}

test('getCandidateWorkflowState distinguishes pending review, binding, linked and rejected detections', () => {
  assert.equal(
    getCandidateWorkflowState(makeDetection({
      candidateStatus: 'under_review',
      reviewStatus: 'pending',
      matchedEnterpriseId: null,
    })),
    'pending_review',
  );

  assert.equal(
    getCandidateWorkflowState(makeDetection({
      candidateStatus: 'approved',
      reviewStatus: 'confirmed',
      matchedEnterpriseId: null,
    })),
    'needs_binding',
  );

  assert.equal(
    getCandidateWorkflowState(makeDetection({
      candidateStatus: 'approved',
      reviewStatus: 'confirmed',
      matchedEnterpriseId: 'ent-1',
      enterpriseId: 'ent-1',
    })),
    'linked',
  );

  assert.equal(
    getCandidateWorkflowState(makeDetection({
      candidateStatus: 'rejected',
      reviewStatus: 'rejected',
    })),
    'rejected',
  );

  assert.equal(
    getCandidateWorkflowState(makeDetection({
      source: 'address',
      candidateStatus: 'approved',
      reviewStatus: 'confirmed',
      matchedEnterpriseId: null,
    })),
    'approved',
  );
});
