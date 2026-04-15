import assert from 'node:assert/strict';
import test from 'node:test';

import type { DetectionResult, Enterprise } from '../types/enterprise.ts';
import {
  buildDiscoveryFunnelStats,
  buildEnterpriseProvenance,
} from './enterpriseProvenance.ts';

function makeEnterprise(input: Partial<Enterprise> = {}): Enterprise {
  return {
    id: 'ent-1',
    account_number: '',
    enterprise_name: '长鑫存储',
    address: '合肥市测试路 1 号',
    industry_category: '电子制造',
    major_category: '',
    sub_category: '',
    composite_score: 0,
    probability_level: '高',
    match_dimension_details: {},
    longitude: 117.2,
    latitude: 31.8,
    geocoding_status: 'success',
    has_cooling_tower: true,
    cooling_tower_count: 2,
    detection_confidence: 0.92,
    detection_status: 'detected',
    detected_tower_total_area_m2: 120,
    detected_tower_avg_area_m2: 60,
    detected_tower_max_area_m2: 70,
    estimated_building_area: 0,
    unit_cooling_load: 0,
    peak_cooling_load: 0,
    total_cooling_capacity_rt: 0,
    chiller_count: 0,
    single_unit_capacity_rt: 0,
    single_unit_rated_power_kw: 0,
    cooling_station_rated_power_kw: 0,
    cooling_station_rated_power_mw: 0,
    hvac_estimate_details: null,
    original_image_url: null,
    annotated_image_url: null,
    image_uploaded_at: '2026-04-15T10:00:00.000Z',
    created_at: '2026-04-15T09:00:00.000Z',
    updated_at: '2026-04-15T10:00:00.000Z',
    ...input,
  };
}

function makeDetectionResult(input: Partial<DetectionResult> = {}): DetectionResult {
  return {
    id: 'det-1',
    enterprise_id: 'ent-1',
    account_number: '',
    image_path: 'scan-session-1/stitched_01.png',
    detection_id: 0,
    confidence: 0.92,
    class_name: 'cooling_tower',
    bbox_x1: 10,
    bbox_y1: 10,
    bbox_x2: 20,
    bbox_y2: 20,
    center_x: 15,
    center_y: 15,
    bbox_width: 10,
    bbox_height: 10,
    bbox_area: 100,
    created_at: '2026-04-15T09:30:00.000Z',
    ...input,
  };
}

test('buildDiscoveryFunnelStats summarizes scan task and candidate funnel counts', () => {
  const stats = buildDiscoveryFunnelStats({
    totalScanTasks: 3,
    candidates: [
      { status: 'under_review', enterprise_id: null },
      { status: 'needs_info', enterprise_id: null },
      { status: 'approved', enterprise_id: null },
      { status: 'approved', enterprise_id: 'ent-1' },
      { status: 'converted', enterprise_id: 'ent-2' },
      { status: 'rejected', enterprise_id: null },
    ],
  });

  assert.deepEqual(stats, {
    totalScanTasks: 3,
    pendingReviewCandidates: 2,
    approvedCandidates: 3,
    rejectedCandidates: 1,
    needsBindingCandidates: 1,
  });
});

test('buildEnterpriseProvenance resolves scan session, screenshot, candidate and latest detection asset', () => {
  const provenance = buildEnterpriseProvenance({
    enterprise: makeEnterprise({
      match_dimension_details: {
        source: 'address-upload',
        screenshot_id: 'shot-fallback',
      },
    }),
    candidate: {
      id: 'cand-1',
      candidate_code: 'SC-123',
      scan_session_id: 'session-1',
      source_label: 'area_scan_detection',
      source_payload: {
        source: 'area',
        screenshotId: 'shot-1',
      },
      created_at: '2026-04-15T09:20:00.000Z',
    },
    detectionResults: [
      makeDetectionResult({ created_at: '2026-04-15T09:30:00.000Z', image_path: 'scan/first.png' }),
      makeDetectionResult({ id: 'det-2', created_at: '2026-04-15T09:35:00.000Z', image_path: 'scan/latest.png' }),
    ],
  });

  assert.equal(provenance.sourceMode, 'area');
  assert.equal(provenance.sourceLabel, '区域截图候选');
  assert.equal(provenance.scanSessionId, 'session-1');
  assert.equal(provenance.screenshotId, 'shot-1');
  assert.equal(provenance.candidateId, 'cand-1');
  assert.equal(provenance.candidateCode, 'SC-123');
  assert.equal(provenance.latestDetectionImagePath, 'scan/latest.png');
  assert.equal(provenance.latestDetectionCreatedAt, '2026-04-15T09:35:00.000Z');
});
