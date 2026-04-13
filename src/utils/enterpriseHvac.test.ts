import assert from 'node:assert/strict';
import test from 'node:test';

import { recomputeEnterpriseHvac } from './enterpriseHvac.ts';

function makeRepo() {
  const updates: Array<{ enterpriseId: string; values: Record<string, unknown> }> = [];

  return {
    updates,
    repo: {
      async getEnterprise() {
        return {
          id: 'ent-1',
          industry_category: '数据中心',
          annotated_image_url: null,
        };
      },
      async listDetectionResults() {
        return [
          { screenshot_id: 'shot-1', confidence: 0.76, bbox_area: 1600 },
          { screenshot_id: 'shot-1', confidence: 0.91, bbox_area: 2500 },
        ];
      },
      async listScreenshots() {
        return [{ id: 'shot-1', session_id: 'session-1', lat: 31.2 }];
      },
      async listSessions() {
        return [{ id: 'session-1', zoom_level: 18 }];
      },
      async updateEnterprise(enterpriseId: string, values: Record<string, unknown>) {
        updates.push({ enterpriseId, values });
      },
    },
  };
}

test('recomputeEnterpriseHvac aggregates measured tower size and updates enterprise metrics', async () => {
  const { repo, updates } = makeRepo();

  const payload = await recomputeEnterpriseHvac(repo, 'ent-1');

  assert.equal(updates.length, 1);
  assert.equal(payload.cooling_tower_count, 2);
  assert.equal(payload.has_cooling_tower, true);
  assert.equal(payload.detection_status, 'detected');
  assert.ok(payload.detected_tower_total_area_m2 > 0);
  assert.ok(payload.cooling_station_rated_power_kw > 0);
  assert.equal(payload.hvac_estimate_details?.method, 'count-and-size');
  assert.equal(payload.detection_confidence, 0.91);
});

test('recomputeEnterpriseHvac clears hvac metrics when no detections remain', async () => {
  const updates: Array<Record<string, unknown>> = [];

  const payload = await recomputeEnterpriseHvac({
    async getEnterprise() {
      return {
        id: 'ent-2',
        industry_category: '办公',
        annotated_image_url: null,
      };
    },
    async listDetectionResults() {
      return [];
    },
    async listScreenshots() {
      return [];
    },
    async listSessions() {
      return [];
    },
    async updateEnterprise(_enterpriseId: string, values: Record<string, unknown>) {
      updates.push(values);
    },
  }, 'ent-2');

  assert.equal(payload.cooling_tower_count, 0);
  assert.equal(payload.has_cooling_tower, false);
  assert.equal(payload.detection_status, 'no_result');
  assert.equal(payload.cooling_station_rated_power_kw, 0);
  assert.equal(payload.detected_tower_total_area_m2, 0);
  assert.equal(updates.length, 1);
});
