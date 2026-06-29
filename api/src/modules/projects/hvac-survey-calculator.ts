import type { ProjectHvacDeviceType } from './project.schemas.js';

export interface HvacMonthlySavingInput {
  runNum: number;
  ratedPowerKw: number;
  runDays: number;
  runDayHours: number;
  loadRatePct: number;
  savingRate: number;
  electricityPricePerKwh: number;
}

export interface HvacMonthlySavingResult {
  energyBeforeKwh: number;
  energyAfterKwh: number;
  savingEnergyKwh: number;
  savingCostCny: number;
}

export interface HvacEvaluationEquipmentAsset {
  id: string;
  deviceType: ProjectHvacDeviceType;
  ratedPowerKw: number | null;
}

export interface HvacEvaluationMonthlyProfile {
  equipmentAssetId: string;
  month: number;
  runNum: number;
  runDays: number;
  runDayHours: number;
  loadRatePct: number;
}

export interface HvacSavingModeConfig {
  deviceType: Exclude<ProjectHvacDeviceType, 'unknown'>;
  avgBase: number;
  monthlyRates: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export interface HvacEvaluationInput {
  electricityPricePerKwh: number;
  equipmentAssets: HvacEvaluationEquipmentAsset[];
  monthlyProfiles: HvacEvaluationMonthlyProfile[];
  savingConfigs: HvacSavingModeConfig[];
}

export interface HvacEvaluationSummary {
  energyBeforeKwh: number;
  energyAfterKwh: number;
  savingEnergyKwh: number;
  savingCostCny: number;
  savingRate: number;
}

export interface HvacEvaluationResult {
  yearEnergyBeforeKwh: number;
  yearEnergyAfterKwh: number;
  yearSavingEnergyKwh: number;
  yearSavingCostCny: number;
  yearSavingRate: number;
  byDeviceType: Record<string, HvacEvaluationSummary>;
  monthTrends: Array<{
    month: number;
    energyBeforeKwh: number;
    energyAfterKwh: number;
    savingEnergyKwh: number;
    savingCostCny: number;
  }>;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

function assertNonNegativeFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
}

export function normalizeLoadRatePct(value: unknown): number {
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/%$/, '');
    return normalizeLoadRatePct(Number(trimmed));
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('loadRatePct must be numeric');
  }

  const normalized = value > 0 && value <= 1 ? value * 100 : value;
  if (normalized < 0 || normalized > 100) {
    throw new Error('loadRatePct must be between 0 and 100');
  }

  return round2(normalized);
}

export function calculateHvacMonthlySaving(input: HvacMonthlySavingInput): HvacMonthlySavingResult {
  assertNonNegativeFinite(input.runNum, 'runNum');
  assertNonNegativeFinite(input.ratedPowerKw, 'ratedPowerKw');
  assertNonNegativeFinite(input.runDays, 'runDays');
  assertNonNegativeFinite(input.runDayHours, 'runDayHours');
  assertNonNegativeFinite(input.savingRate, 'savingRate');
  assertNonNegativeFinite(input.electricityPricePerKwh, 'electricityPricePerKwh');

  if (input.runDayHours > 24) {
    throw new Error('runDayHours must be less than or equal to 24');
  }
  if (input.savingRate > 1) {
    throw new Error('savingRate must be less than or equal to 1');
  }

  const loadRatePct = normalizeLoadRatePct(input.loadRatePct);
  const energyBeforeKwh = input.runNum
    * input.ratedPowerKw
    * input.runDays
    * input.runDayHours
    * (loadRatePct / 100);
  const energyAfterKwh = energyBeforeKwh * (1 - input.savingRate);
  const savingEnergyKwh = energyBeforeKwh - energyAfterKwh;
  const savingCostCny = savingEnergyKwh * input.electricityPricePerKwh;

  return {
    energyBeforeKwh: round2(energyBeforeKwh),
    energyAfterKwh: round2(energyAfterKwh),
    savingEnergyKwh: round2(savingEnergyKwh),
    savingCostCny: round2(savingCostCny),
  };
}

function emptySummary(): HvacEvaluationSummary {
  return {
    energyBeforeKwh: 0,
    energyAfterKwh: 0,
    savingEnergyKwh: 0,
    savingCostCny: 0,
    savingRate: 0,
  };
}

function addSummary(base: HvacEvaluationSummary, addition: HvacMonthlySavingResult): HvacEvaluationSummary {
  const energyBeforeKwh = base.energyBeforeKwh + addition.energyBeforeKwh;
  const energyAfterKwh = base.energyAfterKwh + addition.energyAfterKwh;
  const savingEnergyKwh = base.savingEnergyKwh + addition.savingEnergyKwh;
  const savingCostCny = base.savingCostCny + addition.savingCostCny;

  return {
    energyBeforeKwh: round2(energyBeforeKwh),
    energyAfterKwh: round2(energyAfterKwh),
    savingEnergyKwh: round2(savingEnergyKwh),
    savingCostCny: round2(savingCostCny),
    savingRate: energyBeforeKwh > 0 ? round4(savingEnergyKwh / energyBeforeKwh) : 0,
  };
}

export function calculateHvacEvaluation(input: HvacEvaluationInput): HvacEvaluationResult {
  assertNonNegativeFinite(input.electricityPricePerKwh, 'electricityPricePerKwh');

  const assetsById = new Map(input.equipmentAssets.map((asset) => [asset.id, asset]));
  const configsByType = new Map(input.savingConfigs.map((config) => [config.deviceType, config]));
  const byDeviceType: Record<string, HvacEvaluationSummary> = {};
  const monthSummaries = new Map<number, HvacEvaluationSummary>();
  let yearSummary = emptySummary();

  for (const profile of input.monthlyProfiles) {
    const asset = assetsById.get(profile.equipmentAssetId);
    if (!asset || asset.deviceType === 'unknown' || !asset.ratedPowerKw) {
      continue;
    }

    const config = configsByType.get(asset.deviceType);
    const monthRate = config?.monthlyRates[profile.month - 1] ?? 0;
    const savingRate = (config?.avgBase ?? 0) * monthRate;
    const monthlyResult = calculateHvacMonthlySaving({
      runNum: profile.runNum,
      ratedPowerKw: asset.ratedPowerKw,
      runDays: profile.runDays,
      runDayHours: profile.runDayHours,
      loadRatePct: profile.loadRatePct,
      savingRate,
      electricityPricePerKwh: input.electricityPricePerKwh,
    });

    byDeviceType[asset.deviceType] = addSummary(byDeviceType[asset.deviceType] ?? emptySummary(), monthlyResult);
    monthSummaries.set(profile.month, addSummary(monthSummaries.get(profile.month) ?? emptySummary(), monthlyResult));
    yearSummary = addSummary(yearSummary, monthlyResult);
  }

  return {
    yearEnergyBeforeKwh: yearSummary.energyBeforeKwh,
    yearEnergyAfterKwh: yearSummary.energyAfterKwh,
    yearSavingEnergyKwh: yearSummary.savingEnergyKwh,
    yearSavingCostCny: yearSummary.savingCostCny,
    yearSavingRate: yearSummary.savingRate,
    byDeviceType,
    monthTrends: [...monthSummaries.entries()]
      .sort(([leftMonth], [rightMonth]) => leftMonth - rightMonth)
      .map(([month, summary]) => ({
        month,
        energyBeforeKwh: summary.energyBeforeKwh,
        energyAfterKwh: summary.energyAfterKwh,
        savingEnergyKwh: summary.savingEnergyKwh,
        savingCostCny: summary.savingCostCny,
      })),
  };
}
