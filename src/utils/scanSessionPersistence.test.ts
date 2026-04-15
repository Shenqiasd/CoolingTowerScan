import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRestoredScanSession } from './scanSessionPersistence.ts';

test('buildRestoredScanSession rebuilds screenshots and detections from persisted rows', () => {
  const restored = buildRestoredScanSession({
    sessionId: 'session-1',
    mode: 'address',
    screenshots: [
      {
        id: 'shot-1',
        session_id: 'session-1',
        enterprise_id: 'ent-1',
        filename: 'stitched_Z18_test.png',
        storage_url: 'https://example.com/source.png',
        annotated_url: 'https://example.com/annotated.png',
        lng: 121.5,
        lat: 31.2,
        row_idx: 0,
        col_idx: 0,
        address_label: '测试地址',
        resolved_address: '上海市浦东新区测试路 1 号',
        has_cooling_tower: true,
        tower_count: 2,
        max_confidence: 0.78,
        detection_status: 'detected',
        review_status: 'confirmed',
      },
    ],
    candidateRows: [
      {
        id: 'cand-1',
        screenshot_id: 'shot-1',
        status: 'approved',
      },
    ],
    detectionRows: [
      {
        screenshot_id: 'shot-1',
        confidence: 0.78,
        class_name: 'cooling_tower',
        bbox_x1: 10,
        bbox_y1: 20,
        bbox_x2: 30,
        bbox_y2: 40,
      },
      {
        screenshot_id: 'shot-1',
        confidence: 0.62,
        class_name: 'cooling_tower',
        bbox_x1: 50,
        bbox_y1: 60,
        bbox_x2: 70,
        bbox_y2: 80,
      },
    ],
  });

  assert.equal(restored.sessionId, 'session-1');
  assert.equal(restored.status, 'complete');
  assert.equal(restored.task?.status, 'completed');
  assert.equal(restored.task?.mode, 'address');
  assert.equal(restored.screenshots.length, 1);
  assert.equal(restored.screenshots[0]?.sessionId, 'session-1');
  assert.equal(restored.screenshots[0]?.dataUrl, null);
  assert.equal(restored.screenshots[0]?.publicUrl, 'https://example.com/source.png');
  assert.equal(restored.screenshots[0]?.resolvedAddress, '上海市浦东新区测试路 1 号');

  assert.equal(restored.detections.length, 1);
  assert.equal(restored.detections[0]?.screenshotId, 'shot-1');
  assert.equal(restored.detections[0]?.hasCoolingTower, true);
  assert.equal(restored.detections[0]?.count, 2);
  assert.equal(restored.detections[0]?.confidence, 0.78);
  assert.equal(restored.detections[0]?.annotatedUrl, 'https://example.com/annotated.png');
  assert.equal(restored.detections[0]?.reviewStatus, 'confirmed');
  assert.equal(restored.detections[0]?.candidateId, 'cand-1');
  assert.equal(restored.detections[0]?.candidateStatus, 'approved');
  assert.equal(restored.detections[0]?.resolvedAddress, '上海市浦东新区测试路 1 号');
  assert.equal(restored.detections[0]?.detections.length, 2);
});

test('buildRestoredScanSession keeps screenshot-only rows pending until detection finishes', () => {
  const restored = buildRestoredScanSession({
    sessionId: 'session-2',
    mode: 'area',
    screenshots: [
      {
        id: 'shot-pending',
        session_id: 'session-2',
        enterprise_id: null,
        filename: 'scan_R0_C0_Z18.png',
        storage_url: 'https://example.com/source.png',
        annotated_url: null,
        lng: 121.5,
        lat: 31.2,
        row_idx: 0,
        col_idx: 0,
        address_label: null,
        resolved_address: null,
        has_cooling_tower: false,
        tower_count: 0,
        max_confidence: 0,
        detection_status: 'pending',
        review_status: 'pending',
      },
    ],
    candidateRows: [],
    detectionRows: [],
  });

  assert.equal(restored.status, 'screenshotting');
  assert.equal(restored.task?.status, 'capturing');
  assert.equal(restored.detections.length, 0);
  assert.equal(restored.screenshots[0]?.source, 'area');
});
