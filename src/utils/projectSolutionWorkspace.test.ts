import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDefaultSolutionWorkspace,
  createSolutionWorkspaceDraft,
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

  const draft = createSolutionWorkspaceDraft(workspace);

  assert.equal(draft.projectId, 'project-123');
  assert.equal(draft.technicalAssumptions.baselineLoadRt, '680');
  assert.equal(draft.technicalAssumptions.targetLoadRt, '540');
  assert.equal(draft.technicalAssumptions.operatingHoursPerYear, '');
  assert.equal(draft.technicalAssumptions.electricityPricePerKwh, '0.82');
  assert.equal(draft.technicalAssumptions.baselineCop, '4.2');
  assert.equal(draft.technicalAssumptions.targetCop, '5.6');
  assert.equal(draft.technicalAssumptions.systemLossFactor, '1.08');
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
  });
});
