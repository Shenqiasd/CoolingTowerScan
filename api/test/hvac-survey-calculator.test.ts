import { describe, expect, it } from 'vitest';

import {
  calculateHvacEvaluation,
  calculateHvacMonthlySaving,
  normalizeLoadRatePct,
} from '../src/modules/projects/hvac-survey-calculator.js';

describe('hvac survey calculator', () => {
  it('normalizes load rate to 0-100 percent units', () => {
    expect(normalizeLoadRatePct(0.75)).toBe(75);
    expect(normalizeLoadRatePct(75)).toBe(75);
    expect(normalizeLoadRatePct('75%')).toBe(75);
  });

  it('rejects invalid load rates before calculation', () => {
    expect(() => normalizeLoadRatePct(101)).toThrow('loadRatePct must be between 0 and 100');
    expect(() => normalizeLoadRatePct('bad')).toThrow('loadRatePct must be numeric');
  });

  it('calculates monthly energy and savings from equipment profile', () => {
    const result = calculateHvacMonthlySaving({
      runNum: 2,
      ratedPowerKw: 30,
      runDays: 20,
      runDayHours: 10,
      loadRatePct: 75,
      savingRate: 0.12,
      electricityPricePerKwh: 0.8,
    });

    expect(result.energyBeforeKwh).toBe(9000);
    expect(result.energyAfterKwh).toBe(7920);
    expect(result.savingEnergyKwh).toBe(1080);
    expect(result.savingCostCny).toBe(864);
  });

  it('aggregates yearly savings by device type and month', () => {
    const result = calculateHvacEvaluation({
      electricityPricePerKwh: 0.8,
      equipmentAssets: [
        {
          id: 'asset-1',
          deviceType: 'cooling_tower',
          ratedPowerKw: 30,
        },
        {
          id: 'asset-2',
          deviceType: 'chiller',
          ratedPowerKw: 100,
        },
      ],
      monthlyProfiles: [
        {
          equipmentAssetId: 'asset-1',
          month: 1,
          runNum: 2,
          runDays: 20,
          runDayHours: 10,
          loadRatePct: 75,
        },
        {
          equipmentAssetId: 'asset-2',
          month: 1,
          runNum: 1,
          runDays: 10,
          runDayHours: 12,
          loadRatePct: 50,
        },
      ],
      savingConfigs: [
        {
          deviceType: 'cooling_tower',
          avgBase: 0.1,
          monthlyRates: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        },
        {
          deviceType: 'chiller',
          avgBase: 0.2,
          monthlyRates: [0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        },
      ],
    });

    expect(result.yearEnergyBeforeKwh).toBe(15000);
    expect(result.yearEnergyAfterKwh).toBe(13500);
    expect(result.yearSavingEnergyKwh).toBe(1500);
    expect(result.yearSavingCostCny).toBe(1200);
    expect(result.yearSavingRate).toBe(0.1);
    expect(result.byDeviceType.cooling_tower?.savingEnergyKwh).toBe(900);
    expect(result.byDeviceType.chiller?.savingEnergyKwh).toBe(600);
    expect(result.monthTrends).toEqual([
      {
        month: 1,
        energyBeforeKwh: 15000,
        energyAfterKwh: 13500,
        savingEnergyKwh: 1500,
        savingCostCny: 1200,
      },
    ]);
  });
});
