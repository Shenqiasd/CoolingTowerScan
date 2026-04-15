import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCommercialSummaryItems,
  createDefaultSolutionWorkspace,
  createSolutionWorkspaceDraft,
  evaluateSolutionWorkspacePayload,
  splitSolutionGateErrors,
  serializeSolutionWorkspaceDraft,
} from './projectSolutionWorkspace.ts';

test('createSolutionWorkspaceDraft converts nullable assumptions into editable strings', () => {
  const workspace = createDefaultSolutionWorkspace('project-123');
  workspace.technicalAssumptions.baselineLoadRt = 680;
  workspace.technicalAssumptions.targetLoadRt = 540;
  workspace.technicalAssumptions.operatingHoursPerYear = null;
  workspace.technicalAssumptions.electricityPricePerKwh = 0.82;
  workspace.technicalAssumptions.baselineCop = 4.2;
  workspace.technicalAssumptions.targetCop = 5.6;
  workspace.technicalAssumptions.systemLossFactor = 1.08;
  workspace.commercialBranching.branchType = 'emc';
  workspace.commercialBranching.branchDecisionNote = '节能收益共享';
  workspace.commercialBranching.emc.sharedSavingRate = 0.35;
  workspace.commercialBranching.emc.contractYears = 8;
  workspace.commercialBranching.emc.guaranteedSavingRate = 0.12;

  const draft = createSolutionWorkspaceDraft(workspace);

  assert.equal(draft.projectId, 'project-123');
  assert.equal(draft.technicalAssumptions.baselineLoadRt, '680');
  assert.equal(draft.technicalAssumptions.targetLoadRt, '540');
  assert.equal(draft.technicalAssumptions.operatingHoursPerYear, '');
  assert.equal(draft.technicalAssumptions.electricityPricePerKwh, '0.82');
  assert.equal(draft.technicalAssumptions.baselineCop, '4.2');
  assert.equal(draft.technicalAssumptions.targetCop, '5.6');
  assert.equal(draft.technicalAssumptions.systemLossFactor, '1.08');
  assert.equal(draft.commercialBranching.branchType, 'emc');
  assert.equal(draft.commercialBranching.branchDecisionNote, '节能收益共享');
  assert.equal(draft.commercialBranching.emc.sharedSavingRate, '0.35');
  assert.equal(draft.commercialBranching.emc.contractYears, '8');
  assert.equal(draft.commercialBranching.emc.guaranteedSavingRate, '0.12');
  assert.equal(draft.lastSnapshotVersion, 0);
});

test('serializeSolutionWorkspaceDraft trims text and converts numeric fields into nullable numbers', () => {
  const payload = serializeSolutionWorkspaceDraft({
    projectId: 'project-456',
    technicalAssumptions: {
      baselineLoadRt: ' 900 ',
      targetLoadRt: ' 700 ',
      operatingHoursPerYear: '',
      electricityPricePerKwh: ' 0.76 ',
      baselineCop: ' 4.2 ',
      targetCop: ' 5.1 ',
      systemLossFactor: ' 1.08 ',
    },
    commercialBranching: {
      branchType: 'epc',
      branchDecisionNote: '先走 EPC 快速改造',
      freezeReady: false,
      epc: {
        capexCny: ' 2600000 ',
        grossMarginRate: ' 0.18 ',
        deliveryMonths: ' 6 ',
      },
      emc: {
        sharedSavingRate: '',
        contractYears: '',
        guaranteedSavingRate: '',
      },
    },
    commercialFreezeApproval: {
      status: 'idle',
      requestedAt: null,
      requestedBy: null,
      requestedSnapshotVersion: null,
      requestedBranchType: null,
      decidedAt: null,
      decidedBy: null,
      decisionComment: '',
    },
    calculationSummary: {
      baselineAnnualEnergyKwh: 320000,
      targetAnnualEnergyKwh: 210000,
      annualPowerSavingKwh: 110000,
      annualCostSavingCny: 83600,
      efficiencyImprovementRatio: 0.34,
      baselineCoolingPowerKw: 100,
      targetCoolingPowerKw: 82,
    },
    gateValidation: {
      canSnapshot: false,
      errors: [],
    },
    lastSnapshotVersion: 0,
    lastSnapshotAt: null,
  });

  assert.deepEqual(payload, {
    technicalAssumptions: {
      baselineLoadRt: 900,
      targetLoadRt: 700,
      operatingHoursPerYear: null,
      electricityPricePerKwh: 0.76,
      baselineCop: 4.2,
      targetCop: 5.1,
      systemLossFactor: 1.08,
    },
    commercialBranching: {
      branchType: 'epc',
      branchDecisionNote: '先走 EPC 快速改造',
      freezeReady: false,
      epc: {
        capexCny: 2600000,
        grossMarginRate: 0.18,
        deliveryMonths: 6,
      },
      emc: {
        sharedSavingRate: null,
        contractYears: null,
        guaranteedSavingRate: null,
      },
    },
  });
});

test('splitSolutionGateErrors separates technical and commercial gate messages', () => {
  const result = splitSolutionGateErrors([
    'baselineLoadRt must be greater than 0',
    'targetCop must be greater than baselineCop',
    'commercial freezeReady must be confirmed',
    'epc.capexCny must be greater than 0',
  ]);

  assert.deepEqual(result, {
    technical: [
      '基线负荷需大于 0',
      '目标 COP 需高于基线 COP',
    ],
    commercial: [
      '需要确认商业冻结前校验',
      'EPC 设备投资额需大于 0',
    ],
  });
});

test('buildCommercialSummaryItems returns branch-aware summary cards', () => {
  const workspace = createDefaultSolutionWorkspace('project-789');
  workspace.commercialBranching.branchType = 'emc';
  workspace.commercialBranching.freezeReady = true;
  workspace.commercialBranching.emc.sharedSavingRate = 0.28;
  workspace.commercialBranching.emc.contractYears = 10;
  workspace.commercialBranching.emc.guaranteedSavingRate = 0.12;
  workspace.calculationSummary.annualCostSavingCny = 1865200;

  assert.deepEqual(buildCommercialSummaryItems(workspace), [
    {
      label: '收益分成比例',
      value: '28.0%',
      hint: '合同分成口径',
    },
    {
      label: '合同年限',
      value: '10 年',
      hint: 'EMC 合同周期',
    },
    {
      label: '保底节能率',
      value: '12.0%',
      hint: '当前可选的保底承诺',
    },
    {
      label: '年节约电费',
      value: '1,865,200 元',
      hint: '用于收益测算底稿',
    },
  ]);
});

test('evaluateSolutionWorkspacePayload reflects current draft gate state before saving', () => {
  const result = evaluateSolutionWorkspacePayload({
    technicalAssumptions: {
      baselineLoadRt: 1200,
      targetLoadRt: 980,
      operatingHoursPerYear: 4200,
      electricityPricePerKwh: 0.82,
      baselineCop: 4.2,
      targetCop: 5.6,
      systemLossFactor: 1.08,
    },
    commercialBranching: {
      branchType: 'epc',
      branchDecisionNote: '先走 EPC',
      freezeReady: false,
      epc: {
        capexCny: 2600000,
        grossMarginRate: 0.18,
        deliveryMonths: 6,
      },
      emc: {
        sharedSavingRate: null,
        contractYears: null,
        guaranteedSavingRate: null,
      },
    },
  });

  assert.equal(result.gateValidation.canSnapshot, false);
  assert.deepEqual(result.gateValidation.errors, [
    'commercial freezeReady must be confirmed',
  ]);
});
