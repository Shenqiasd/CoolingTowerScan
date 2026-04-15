import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRecentScanTaskSummary, getTaskStatusMeta } from './activeScanTaskModel.ts';

test('getTaskStatusMeta returns banner copy for review pending tasks', () => {
  const meta = getTaskStatusMeta({
    id: 'task-1',
    mode: 'area',
    status: 'review_pending',
    screenshotCount: 9,
    detectedCount: 7,
    reviewedCount: 2,
  });

  assert.deepEqual(meta, {
    label: '待审核',
    description: 'AI 已完成，等待确认候选结果',
    tone: 'amber',
  });
});

test('buildRecentScanTaskSummary marks current active task and formats task counts', () => {
  const summary = buildRecentScanTaskSummary({
    row: {
      id: 'session-1',
      mode: 'address',
      label: '日月光',
      total_count: 1,
      zoom_level: 18,
      created_at: '2026-04-15T08:00:00.000Z',
    },
    activeSessionId: 'session-1',
  });

  assert.equal(summary.id, 'session-1');
  assert.equal(summary.name, '日月光');
  assert.equal(summary.modeLabel, '地址扫描');
  assert.equal(summary.countLabel, '1 张');
  assert.equal(summary.isActive, true);
});
