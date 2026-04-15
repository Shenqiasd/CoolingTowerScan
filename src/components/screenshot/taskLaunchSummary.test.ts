import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTaskLaunchSummary } from './taskLaunchSummaryModel.ts';
import { resolvePrecisionPreset } from './PrecisionPreset.ts';

test('resolvePrecisionPreset returns stable zoom and overlap defaults', () => {
  assert.deepEqual(resolvePrecisionPreset('coarse'), {
    zoomLevel: 16,
    overlapPct: 4,
    label: '粗扫',
    description: '覆盖优先，适合大范围排查',
  });

  assert.deepEqual(resolvePrecisionPreset('fine'), {
    zoomLevel: 19,
    overlapPct: 12,
    label: '精扫',
    description: '识别优先，适合重点区域复核',
  });
});

test('buildTaskLaunchSummary computes screenshot count and timing copy', () => {
  const summary = buildTaskLaunchSummary({
    taskName: '临港工业园',
    preset: 'standard',
    preview: { rows: 3, cols: 4, total: 12 },
    delayMs: 1500,
  });

  assert.equal(summary.taskName, '临港工业园');
  assert.equal(summary.presetLabel, '标准');
  assert.equal(summary.screenshotCountLabel, '12 张');
  assert.equal(summary.gridLabel, '3 行 × 4 列');
  assert.equal(summary.captureTimeLabel, '约 18 秒');
  assert.equal(summary.detectTimeLabel, '约 1 分钟');
});
