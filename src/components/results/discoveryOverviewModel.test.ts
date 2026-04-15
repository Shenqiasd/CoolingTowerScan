import assert from 'node:assert/strict';
import test from 'node:test';

import type { StatsData } from '../../types/enterprise.ts';
import { buildDiscoveryOverviewModel } from './discoveryOverviewModel.ts';

function makeStats(input: Partial<StatsData> = {}): StatsData {
  return {
    totalEnterprises: 120,
    confirmedCoolingTower: 48,
    highProbabilityCount: 30,
    mediumProbabilityCount: 40,
    lowProbabilityCount: 50,
    totalCoolingCapacityMW: 16.4,
    totalScanTasks: 9,
    pendingReviewCandidates: 5,
    approvedCandidates: 12,
    rejectedCandidates: 3,
    needsBindingCandidates: 4,
    ...input,
  };
}

test('buildDiscoveryOverviewModel returns queue-focused cards and action hint', () => {
  const model = buildDiscoveryOverviewModel(makeStats());

  assert.equal(model.cards[0]?.label, '扫描任务');
  assert.equal(model.cards[1]?.label, '待审核候选');
  assert.equal(model.cards[1]?.value, '5');
  assert.equal(model.cards[3]?.label, '待绑定企业');
  assert.equal(model.cards[3]?.value, '4');
  assert.equal(model.primaryHint, '当前有 5 个候选待审核，优先在 AI 识别页完成确认。');
});

test('buildDiscoveryOverviewModel falls back to enterprise-oriented hint when review queues are empty', () => {
  const model = buildDiscoveryOverviewModel(makeStats({
    pendingReviewCandidates: 0,
    needsBindingCandidates: 0,
    confirmedCoolingTower: 52,
    totalEnterprises: 140,
  }));

  assert.equal(model.primaryHint, '当前没有待处理候选，可以回到数据总览继续筛选和沉淀企业。');
  assert.equal(model.cards[4]?.label, '已沉淀企业');
  assert.equal(model.cards[4]?.value, '140');
});
