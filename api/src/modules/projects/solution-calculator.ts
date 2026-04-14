const RT_TO_KW = 3.517;

export interface SolutionCalculationInput {
  baselineLoadRt: number;
  targetLoadRt: number;
  operatingHoursPerYear: number;
  electricityPricePerKwh: number;
  baselineCop: number;
  targetCop: number;
  systemLossFactor: number;
}

export interface SolutionSavingsEstimate {
  baselineAnnualEnergyKwh: number;
  targetAnnualEnergyKwh: number;
  annualPowerSavingKwh: number;
  annualCostSavingCny: number;
  efficiencyImprovementRatio: number;
  baselineCoolingPowerKw: number;
  targetCoolingPowerKw: number;
}

export interface SolutionCalculationResult {
  savingsEstimate: SolutionSavingsEstimate;
  errors: string[];
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function zeroEstimate(): SolutionSavingsEstimate {
  return {
    baselineAnnualEnergyKwh: 0,
    targetAnnualEnergyKwh: 0,
    annualPowerSavingKwh: 0,
    annualCostSavingCny: 0,
    efficiencyImprovementRatio: 0,
    baselineCoolingPowerKw: 0,
    targetCoolingPowerKw: 0,
  };
}

export function calculateSolutionSavings(input: SolutionCalculationInput): SolutionSavingsEstimate {
  const {
    baselineLoadRt,
    targetLoadRt,
    operatingHoursPerYear,
    electricityPricePerKwh,
    baselineCop,
    targetCop,
    systemLossFactor,
  } = input;

  if (
    baselineLoadRt <= 0
    || targetLoadRt <= 0
    || operatingHoursPerYear <= 0
    || electricityPricePerKwh <= 0
    || baselineCop <= 0
    || targetCop <= 0
    || systemLossFactor <= 0
  ) {
    return zeroEstimate();
  }

  const baselineCoolingPowerKw = (baselineLoadRt * RT_TO_KW) / baselineCop;
  const targetCoolingPowerKw = (targetLoadRt * RT_TO_KW) / targetCop;
  const baselineAnnualEnergyKwh = baselineCoolingPowerKw * operatingHoursPerYear * systemLossFactor;
  const targetAnnualEnergyKwh = targetCoolingPowerKw * operatingHoursPerYear * systemLossFactor;
  const annualPowerSavingKwh = baselineAnnualEnergyKwh - targetAnnualEnergyKwh;
  const annualCostSavingCny = annualPowerSavingKwh * electricityPricePerKwh;
  const efficiencyImprovementRatio = baselineAnnualEnergyKwh > 0
    ? 1 - (targetAnnualEnergyKwh / baselineAnnualEnergyKwh)
    : 0;

  return {
    baselineAnnualEnergyKwh: round2(baselineAnnualEnergyKwh),
    targetAnnualEnergyKwh: round2(targetAnnualEnergyKwh),
    annualPowerSavingKwh: round2(annualPowerSavingKwh),
    annualCostSavingCny: round2(annualCostSavingCny),
    efficiencyImprovementRatio: round2(efficiencyImprovementRatio),
    baselineCoolingPowerKw: round2(baselineCoolingPowerKw),
    targetCoolingPowerKw: round2(targetCoolingPowerKw),
  };
}

export function buildSolutionCalculationResult(input: SolutionCalculationInput): SolutionCalculationResult {
  const errors: string[] = [];

  if (input.baselineLoadRt <= 0) {
    errors.push('baselineLoadRt must be greater than 0');
  }
  if (input.targetLoadRt <= 0) {
    errors.push('targetLoadRt must be greater than 0');
  }
  if (input.operatingHoursPerYear <= 0) {
    errors.push('operatingHoursPerYear must be greater than 0');
  }
  if (input.electricityPricePerKwh <= 0) {
    errors.push('electricityPricePerKwh must be greater than 0');
  }
  if (input.baselineCop <= 0) {
    errors.push('baselineCop must be greater than 0');
  }
  if (input.targetCop <= 0) {
    errors.push('targetCop must be greater than 0');
  }
  if (input.systemLossFactor <= 0) {
    errors.push('systemLossFactor must be greater than 0');
  }
  if (input.targetLoadRt > input.baselineLoadRt) {
    errors.push('targetLoadRt must be less than or equal to baselineLoadRt');
  }
  if (input.targetCop <= input.baselineCop) {
    errors.push('targetCop must be greater than baselineCop');
  }

  const savingsEstimate = errors.length === 0
    ? calculateSolutionSavings(input)
    : zeroEstimate();

  if (errors.length > 0 || savingsEstimate.targetAnnualEnergyKwh >= savingsEstimate.baselineAnnualEnergyKwh) {
    errors.push('target annual energy must be lower than baseline annual energy');
  }

  return {
    savingsEstimate,
    errors,
  };
}
