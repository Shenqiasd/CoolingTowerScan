import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateHVAC } from './hvacCalculator.ts';

test('calculateHVAC returns zeros and no-estimate interval details for zero towers', () => {
  const result = calculateHVAC(0, '办公楼');

  assert.equal(result.cooling_station_rated_power_kw, 0);
  assert.equal(result.detected_tower_total_area_m2, 0);
  assert.equal(result.hvac_estimate_details?.method, 'none');
  assert.equal(result.hvac_estimate_details?.scenarios.typical.cooling_station_rated_power_kw, 0);
});

test('calculateHVAC uses detected tower size to increase typical capacity', () => {
  const countOnly = calculateHVAC(2, '数据中心');
  const sizeAware = calculateHVAC(2, '数据中心', {
    detectedTowerTotalAreaM2: 72,
    detectedTowerAvgAreaM2: 36,
    detectedTowerMaxAreaM2: 40,
  });

  assert.equal(sizeAware.hvac_estimate_details?.method, 'count-and-size');
  assert.ok(sizeAware.total_cooling_capacity_rt > countOnly.total_cooling_capacity_rt);
  assert.ok(
    sizeAware.hvac_estimate_details!.scenarios.aggressive.total_cooling_capacity_rt >
      sizeAware.hvac_estimate_details!.scenarios.typical.total_cooling_capacity_rt,
  );
  assert.ok(
    sizeAware.hvac_estimate_details!.scenarios.typical.total_cooling_capacity_rt >
      sizeAware.hvac_estimate_details!.scenarios.conservative.total_cooling_capacity_rt,
  );
});

test('calculateHVAC keeps count-only fallback when no measured tower size exists', () => {
  const result = calculateHVAC(3, '工业');

  assert.equal(result.hvac_estimate_details?.method, 'count-only');
  assert.equal(result.detected_tower_avg_area_m2, 0);
  assert.ok(result.hvac_estimate_details!.scenarios.typical.total_cooling_capacity_rt > 0);
});
