import { describe, expect, it } from 'vitest';

import {
  buildSolutionCalculationResult,
  calculateSolutionSavings,
} from '../src/modules/projects/solution-calculator.js';

describe('solution-calculator', () => {
  it('calculates annual energy and cost savings from technical assumptions', () => {
    const result = calculateSolutionSavings({
      baselineLoadRt: 1200,
      targetLoadRt: 1000,
      operatingHoursPerYear: 4200,
      electricityPricePerKwh: 0.82,
      baselineCop: 4.2,
      targetCop: 5.6,
      systemLossFactor: 1.08,
    });

    expect(result.baselineAnnualEnergyKwh).toBeCloseTo(4558032, 2);
    expect(result.targetAnnualEnergyKwh).toBeCloseTo(2848770, 2);
    expect(result.annualPowerSavingKwh).toBeCloseTo(1709262, 2);
    expect(result.annualCostSavingCny).toBeCloseTo(1401594.84, 2);
    expect(result.efficiencyImprovementRatio).toBeCloseTo(0.38, 2);
  });

  it('returns gate errors when assumptions are incomplete or non-improving', () => {
    const result = buildSolutionCalculationResult({
      baselineLoadRt: 800,
      targetLoadRt: 900,
      operatingHoursPerYear: 0,
      electricityPricePerKwh: 0,
      baselineCop: 4.8,
      targetCop: 4.2,
      systemLossFactor: 0,
    });

    expect(result.errors).toEqual([
      'operatingHoursPerYear must be greater than 0',
      'electricityPricePerKwh must be greater than 0',
      'systemLossFactor must be greater than 0',
      'targetLoadRt must be less than or equal to baselineLoadRt',
      'targetCop must be greater than baselineCop',
      'target annual energy must be lower than baseline annual energy',
    ]);
    expect(result.savingsEstimate.annualPowerSavingKwh).toBe(0);
    expect(result.savingsEstimate.annualCostSavingCny).toBe(0);
  });
});
