import assert from 'node:assert/strict';
import test from 'node:test';

import type { DetectionApiResult } from './detectionApi.ts';
import {
  buildScanCandidateUpsert,
  buildScanCandidateEvidenceRows,
  materializeScanCandidateForDetection,
  type ScanCandidateUpsertRow,
  type ScanCandidateScreenshotContext,
  type StoredDetectionRow,
} from './scanCandidateRepo.ts';

const screenshot: ScanCandidateScreenshotContext = {
  screenshotId: 'shot-1',
  sessionId: 'session-1',
  enterpriseId: null,
  filename: 'scan_R0_C0_Z18.png',
  source: 'area',
  addressLabel: '测试园区',
  resolvedAddress: '上海市浦东新区测试路 1 号',
  lng: 121.5,
  lat: 31.2,
  storageUrl: 'https://example.com/source.png',
};

const result: DetectionApiResult = {
  has_cooling_tower: true,
  count: 2,
  confidence: 0.81,
  detections: [
    {
      x1: 10,
      y1: 20,
      x2: 30,
      y2: 40,
      center_x: 20,
      center_y: 30,
      width: 20,
      height: 20,
      confidence: 0.81,
      class_name: 'cooling_tower',
    },
    {
      x1: 50,
      y1: 60,
      x2: 80,
      y2: 100,
      center_x: 65,
      center_y: 80,
      width: 30,
      height: 40,
      confidence: 0.63,
      class_name: 'cooling_tower',
    },
  ],
};

const detectionRows: StoredDetectionRow[] = [
  {
    id: 'det-1',
    screenshot_id: 'shot-1',
    confidence: 0.81,
    bbox_area: 400,
  },
  {
    id: 'det-2',
    screenshot_id: 'shot-1',
    confidence: 0.63,
    bbox_area: 1200,
  },
];

test('buildScanCandidateUpsert creates an under_review candidate row for tower detections', () => {
  const candidate = buildScanCandidateUpsert({
    screenshot,
    detectionResult: result,
  });

  assert.ok(candidate);
  assert.equal(candidate?.scan_session_id, 'session-1');
  assert.equal(candidate?.status, 'under_review');
  assert.equal(candidate?.source_type, 'cooling_tower_scan');
  assert.equal(candidate?.matched_enterprise_name, '测试园区');
  assert.equal(candidate?.matched_address, '上海市浦东新区测试路 1 号');
  assert.equal(candidate?.cooling_tower_count, 2);
  assert.equal(candidate?.confidence_score, 0.81);
});

test('buildScanCandidateUpsert returns null when no cooling tower was detected', () => {
  const candidate = buildScanCandidateUpsert({
    screenshot,
    detectionResult: {
      ...result,
      has_cooling_tower: false,
      count: 0,
      confidence: 0,
      detections: [],
    },
  });

  assert.equal(candidate, null);
});

test('buildScanCandidateEvidenceRows links original screenshot and bbox evidence rows', () => {
  const rows = buildScanCandidateEvidenceRows({
    candidateId: 'cand-1',
    screenshotId: 'shot-1',
    detectionRows,
  });

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    candidate_id: 'cand-1',
    screenshot_id: 'shot-1',
    detection_result_id: null,
    kind: 'original',
    sort_order: 0,
    metadata: {},
  });
  assert.equal(rows[1]?.detection_result_id, 'det-1');
  assert.equal(rows[1]?.kind, 'bbox');
  assert.equal(rows[2]?.detection_result_id, 'det-2');
  assert.equal(rows[2]?.kind, 'bbox');
});

test('materializeScanCandidateForDetection upserts candidate and replaces evidence rows', async () => {
  const calls: Array<{ step: string; payload: unknown }> = [];

  const repo = {
    async upsertCandidate(row: ScanCandidateUpsertRow) {
      calls.push({ step: 'upsertCandidate', payload: row });
      return { id: 'cand-1' };
    },
    async replaceCandidateEvidences(candidateId: string, rows: unknown[]) {
      calls.push({ step: 'replaceCandidateEvidences', payload: { candidateId, rows } });
    },
    async deleteDetectionCandidate() {
      calls.push({ step: 'deleteDetectionCandidate', payload: null });
    },
  };

  await materializeScanCandidateForDetection({
    repo,
    screenshot,
    detectionResult: result,
    detectionRows,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.step, 'upsertCandidate');
  assert.equal(calls[1]?.step, 'replaceCandidateEvidences');
  assert.deepEqual(calls[1]?.payload, {
    candidateId: 'cand-1',
    rows: buildScanCandidateEvidenceRows({
      candidateId: 'cand-1',
      screenshotId: 'shot-1',
      detectionRows,
    }),
  });
});
