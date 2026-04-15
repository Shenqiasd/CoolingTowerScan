export interface ProjectSolutionTechnicalAssumptions {
  baselineLoadRt: number | null;
  targetLoadRt: number | null;
  operatingHoursPerYear: number | null;
  electricityPricePerKwh: number | null;
  baselineCop: number | null;
  targetCop: number | null;
  systemLossFactor: number | null;
}

export type ProjectCommercialBranchType = 'epc' | 'emc';

export interface ProjectSolutionEpcCommercial {
  capexCny: number | null;
  grossMarginRate: number | null;
  deliveryMonths: number | null;
}

export interface ProjectSolutionEmcCommercial {
  sharedSavingRate: number | null;
  contractYears: number | null;
  guaranteedSavingRate: number | null;
}

export interface ProjectSolutionCommercialBranching {
  branchType: ProjectCommercialBranchType | null;
  branchDecisionNote: string;
  freezeReady: boolean;
  epc: ProjectSolutionEpcCommercial;
  emc: ProjectSolutionEmcCommercial;
}

export interface ProjectSolutionCalculationSummary {
  baselineAnnualEnergyKwh: number;
  targetAnnualEnergyKwh: number;
  annualPowerSavingKwh: number;
  annualCostSavingCny: number;
  efficiencyImprovementRatio: number;
  baselineCoolingPowerKw: number;
  targetCoolingPowerKw: number;
}

export interface ProjectSolutionGateValidation {
  canSnapshot: boolean;
  errors: string[];
}

export interface ProjectSolutionWorkspace {
  projectId: string;
  technicalAssumptions: ProjectSolutionTechnicalAssumptions;
  commercialBranching: ProjectSolutionCommercialBranching;
  calculationSummary: ProjectSolutionCalculationSummary;
  gateValidation: ProjectSolutionGateValidation;
  lastSnapshotVersion: number;
  lastSnapshotAt: string | null;
}

export interface ProjectSolutionSnapshot {
  id: string;
  projectId: string;
  stageCode: string;
  versionNo: number;
  snapshotPayload: Record<string, unknown>;
  calculationSummary: ProjectSolutionCalculationSummary;
  gateErrors: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface ProjectSolutionTechnicalAssumptionsDraft {
  baselineLoadRt: string;
  targetLoadRt: string;
  operatingHoursPerYear: string;
  electricityPricePerKwh: string;
  baselineCop: string;
  targetCop: string;
  systemLossFactor: string;
}

export interface ProjectSolutionEpcCommercialDraft {
  capexCny: string;
  grossMarginRate: string;
  deliveryMonths: string;
}

export interface ProjectSolutionEmcCommercialDraft {
  sharedSavingRate: string;
  contractYears: string;
  guaranteedSavingRate: string;
}

export interface ProjectSolutionCommercialBranchingDraft {
  branchType: ProjectCommercialBranchType | null;
  branchDecisionNote: string;
  freezeReady: boolean;
  epc: ProjectSolutionEpcCommercialDraft;
  emc: ProjectSolutionEmcCommercialDraft;
}

export interface ProjectSolutionWorkspaceDraft {
  projectId: string;
  technicalAssumptions: ProjectSolutionTechnicalAssumptionsDraft;
  commercialBranching: ProjectSolutionCommercialBranchingDraft;
  calculationSummary: ProjectSolutionCalculationSummary;
  gateValidation: ProjectSolutionGateValidation;
  lastSnapshotVersion: number;
  lastSnapshotAt: string | null;
}

export interface ProjectSolutionWorkspacePayload {
  technicalAssumptions: ProjectSolutionTechnicalAssumptions;
  commercialBranching: ProjectSolutionCommercialBranching;
}

export interface ProjectSolutionGateBreakdown {
  technical: string[];
  commercial: string[];
}

export interface ProjectSolutionCommercialSummaryItem {
  label: string;
  value: string;
  hint: string;
}

function toDraftNumber(value: number | null) {
  return value === null ? '' : String(value);
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number | null, digits = 0) {
  if (value === null) {
    return '待补充';
  }

  return `${formatNumber(value * 100, digits)}%`;
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return '待补充';
  }

  return `${formatNumber(value)} 元`;
}

function formatMonths(value: number | null) {
  if (value === null) {
    return '待补充';
  }

  return `${formatNumber(value)} 个月`;
}

function formatYears(value: number | null) {
  if (value === null) {
    return '待补充';
  }

  return `${formatNumber(value)} 年`;
}

function zeroCalculationSummary(): ProjectSolutionCalculationSummary {
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

function normalizeAssumption(value: number | null) {
  return value ?? 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function createDefaultCommercialBranching(): ProjectSolutionCommercialBranching {
  return {
    branchType: null,
    branchDecisionNote: '',
    freezeReady: false,
    epc: {
      capexCny: null,
      grossMarginRate: null,
      deliveryMonths: null,
    },
    emc: {
      sharedSavingRate: null,
      contractYears: null,
      guaranteedSavingRate: null,
    },
  };
}

export function createDefaultSolutionWorkspace(projectId: string): ProjectSolutionWorkspace {
  return {
    projectId,
    technicalAssumptions: {
      baselineLoadRt: null,
      targetLoadRt: null,
      operatingHoursPerYear: null,
      electricityPricePerKwh: null,
      baselineCop: null,
      targetCop: null,
      systemLossFactor: null,
    },
    commercialBranching: createDefaultCommercialBranching(),
    calculationSummary: zeroCalculationSummary(),
    gateValidation: {
      canSnapshot: false,
      errors: [],
    },
    lastSnapshotVersion: 0,
    lastSnapshotAt: null,
  };
}

export function createSolutionWorkspaceDraft(
  workspace: ProjectSolutionWorkspace,
): ProjectSolutionWorkspaceDraft {
  return {
    projectId: workspace.projectId,
    technicalAssumptions: {
      baselineLoadRt: toDraftNumber(workspace.technicalAssumptions.baselineLoadRt),
      targetLoadRt: toDraftNumber(workspace.technicalAssumptions.targetLoadRt),
      operatingHoursPerYear: toDraftNumber(workspace.technicalAssumptions.operatingHoursPerYear),
      electricityPricePerKwh: toDraftNumber(workspace.technicalAssumptions.electricityPricePerKwh),
      baselineCop: toDraftNumber(workspace.technicalAssumptions.baselineCop),
      targetCop: toDraftNumber(workspace.technicalAssumptions.targetCop),
      systemLossFactor: toDraftNumber(workspace.technicalAssumptions.systemLossFactor),
    },
    commercialBranching: {
      branchType: workspace.commercialBranching.branchType,
      branchDecisionNote: workspace.commercialBranching.branchDecisionNote,
      freezeReady: workspace.commercialBranching.freezeReady,
      epc: {
        capexCny: toDraftNumber(workspace.commercialBranching.epc.capexCny),
        grossMarginRate: toDraftNumber(workspace.commercialBranching.epc.grossMarginRate),
        deliveryMonths: toDraftNumber(workspace.commercialBranching.epc.deliveryMonths),
      },
      emc: {
        sharedSavingRate: toDraftNumber(workspace.commercialBranching.emc.sharedSavingRate),
        contractYears: toDraftNumber(workspace.commercialBranching.emc.contractYears),
        guaranteedSavingRate: toDraftNumber(workspace.commercialBranching.emc.guaranteedSavingRate),
      },
    },
    calculationSummary: workspace.calculationSummary,
    gateValidation: workspace.gateValidation,
    lastSnapshotVersion: workspace.lastSnapshotVersion,
    lastSnapshotAt: workspace.lastSnapshotAt,
  };
}

export function serializeSolutionWorkspaceDraft(
  draft: ProjectSolutionWorkspaceDraft,
): ProjectSolutionWorkspacePayload {
  return {
    technicalAssumptions: {
      baselineLoadRt: toNullableNumber(draft.technicalAssumptions.baselineLoadRt),
      targetLoadRt: toNullableNumber(draft.technicalAssumptions.targetLoadRt),
      operatingHoursPerYear: toNullableNumber(draft.technicalAssumptions.operatingHoursPerYear),
      electricityPricePerKwh: toNullableNumber(draft.technicalAssumptions.electricityPricePerKwh),
      baselineCop: toNullableNumber(draft.technicalAssumptions.baselineCop),
      targetCop: toNullableNumber(draft.technicalAssumptions.targetCop),
      systemLossFactor: toNullableNumber(draft.technicalAssumptions.systemLossFactor),
    },
    commercialBranching: {
      branchType: draft.commercialBranching.branchType,
      branchDecisionNote: draft.commercialBranching.branchDecisionNote.trim(),
      freezeReady: draft.commercialBranching.freezeReady,
      epc: {
        capexCny: toNullableNumber(draft.commercialBranching.epc.capexCny),
        grossMarginRate: toNullableNumber(draft.commercialBranching.epc.grossMarginRate),
        deliveryMonths: toNullableNumber(draft.commercialBranching.epc.deliveryMonths),
      },
      emc: {
        sharedSavingRate: toNullableNumber(draft.commercialBranching.emc.sharedSavingRate),
        contractYears: toNullableNumber(draft.commercialBranching.emc.contractYears),
        guaranteedSavingRate: toNullableNumber(draft.commercialBranching.emc.guaranteedSavingRate),
      },
    },
  };
}

export function formatSolutionGateError(error: string) {
  const labelMap: Record<string, string> = {
    'baselineLoadRt must be greater than 0': '基线负荷需大于 0',
    'targetLoadRt must be greater than 0': '目标负荷需大于 0',
    'operatingHoursPerYear must be greater than 0': '年运行小时需大于 0',
    'electricityPricePerKwh must be greater than 0': '电价需大于 0',
    'baselineCop must be greater than 0': '基线 COP 需大于 0',
    'targetCop must be greater than 0': '目标 COP 需大于 0',
    'systemLossFactor must be greater than 0': '系统损耗系数需大于 0',
    'targetLoadRt must be less than or equal to baselineLoadRt': '目标负荷不能高于基线负荷',
    'targetCop must be greater than baselineCop': '目标 COP 需高于基线 COP',
    'target annual energy must be lower than baseline annual energy': '目标年耗电必须低于基线年耗电',
    'commercial branchType is required': '需要先选择商业分支',
    'commercial freezeReady must be confirmed': '需要确认商业冻结前校验',
    'epc.capexCny must be greater than 0': 'EPC 设备投资额需大于 0',
    'epc.grossMarginRate must be greater than 0': 'EPC 目标毛利率需大于 0',
    'epc.deliveryMonths must be greater than 0': 'EPC 交付周期需大于 0',
    'emc.sharedSavingRate must be greater than 0': 'EMC 收益分成比例需大于 0',
    'emc.contractYears must be greater than 0': 'EMC 合同年限需大于 0',
  };

  return labelMap[error] ?? error;
}

export function splitSolutionGateErrors(errors: string[]): ProjectSolutionGateBreakdown {
  return errors.reduce<ProjectSolutionGateBreakdown>((acc, error) => {
    const label = formatSolutionGateError(error);
    if (
      error.startsWith('commercial ')
      || error.startsWith('epc.')
      || error.startsWith('emc.')
    ) {
      acc.commercial.push(label);
    } else {
      acc.technical.push(label);
    }
    return acc;
  }, {
    technical: [],
    commercial: [],
  });
}

export function buildCommercialSummaryItems(
  workspace: Pick<ProjectSolutionWorkspace, 'commercialBranching' | 'calculationSummary'>,
): ProjectSolutionCommercialSummaryItem[] {
  const { commercialBranching, calculationSummary } = workspace;

  if (commercialBranching.branchType === 'epc') {
    return [
      {
        label: '设备投资额',
        value: formatCurrency(commercialBranching.epc.capexCny),
        hint: 'EPC 投资口径',
      },
      {
        label: '目标毛利率',
        value: formatPercent(commercialBranching.epc.grossMarginRate, 1),
        hint: '用于总包报价校验',
      },
      {
        label: '交付周期',
        value: formatMonths(commercialBranching.epc.deliveryMonths),
        hint: '商务交付承诺',
      },
      {
        label: '年节约电费',
        value: formatCurrency(calculationSummary.annualCostSavingCny),
        hint: '技术测算输入的节费结果',
      },
    ];
  }

  if (commercialBranching.branchType === 'emc') {
    return [
      {
        label: '收益分成比例',
        value: formatPercent(commercialBranching.emc.sharedSavingRate, 1),
        hint: '合同分成口径',
      },
      {
        label: '合同年限',
        value: formatYears(commercialBranching.emc.contractYears),
        hint: 'EMC 合同周期',
      },
      {
        label: '保底节能率',
        value: formatPercent(commercialBranching.emc.guaranteedSavingRate, 1),
        hint: '当前可选的保底承诺',
      },
      {
        label: '年节约电费',
        value: formatCurrency(calculationSummary.annualCostSavingCny),
        hint: '用于收益测算底稿',
      },
    ];
  }

  return [
    {
      label: '商业分支',
      value: '待选择',
      hint: '先选择 EPC 或 EMC',
    },
    {
      label: '冻结确认',
      value: commercialBranching.freezeReady ? '已确认' : '未确认',
      hint: '冻结前需要产品/商务确认',
    },
  ];
}

export function evaluateSolutionWorkspacePayload(
  payload: ProjectSolutionWorkspacePayload,
): Pick<ProjectSolutionWorkspace, 'calculationSummary' | 'gateValidation'> {
  const assumptions = payload.technicalAssumptions;
  const normalized = {
    baselineLoadRt: normalizeAssumption(assumptions.baselineLoadRt),
    targetLoadRt: normalizeAssumption(assumptions.targetLoadRt),
    operatingHoursPerYear: normalizeAssumption(assumptions.operatingHoursPerYear),
    electricityPricePerKwh: normalizeAssumption(assumptions.electricityPricePerKwh),
    baselineCop: normalizeAssumption(assumptions.baselineCop),
    targetCop: normalizeAssumption(assumptions.targetCop),
    systemLossFactor: normalizeAssumption(assumptions.systemLossFactor),
  };
  const errors: string[] = [];

  if (normalized.baselineLoadRt <= 0) {
    errors.push('baselineLoadRt must be greater than 0');
  }
  if (normalized.targetLoadRt <= 0) {
    errors.push('targetLoadRt must be greater than 0');
  }
  if (normalized.operatingHoursPerYear <= 0) {
    errors.push('operatingHoursPerYear must be greater than 0');
  }
  if (normalized.electricityPricePerKwh <= 0) {
    errors.push('electricityPricePerKwh must be greater than 0');
  }
  if (normalized.baselineCop <= 0) {
    errors.push('baselineCop must be greater than 0');
  }
  if (normalized.targetCop <= 0) {
    errors.push('targetCop must be greater than 0');
  }
  if (normalized.systemLossFactor <= 0) {
    errors.push('systemLossFactor must be greater than 0');
  }
  if (normalized.targetLoadRt > normalized.baselineLoadRt) {
    errors.push('targetLoadRt must be less than or equal to baselineLoadRt');
  }
  if (normalized.targetCop <= normalized.baselineCop) {
    errors.push('targetCop must be greater than baselineCop');
  }

  const branching = payload.commercialBranching;
  if (!branching.branchType) {
    errors.push('commercial branchType is required');
  } else if (branching.branchType === 'epc') {
    if ((branching.epc.capexCny ?? 0) <= 0) {
      errors.push('epc.capexCny must be greater than 0');
    }
    if ((branching.epc.grossMarginRate ?? 0) <= 0) {
      errors.push('epc.grossMarginRate must be greater than 0');
    }
    if ((branching.epc.deliveryMonths ?? 0) <= 0) {
      errors.push('epc.deliveryMonths must be greater than 0');
    }
  } else {
    if ((branching.emc.sharedSavingRate ?? 0) <= 0) {
      errors.push('emc.sharedSavingRate must be greater than 0');
    }
    if ((branching.emc.contractYears ?? 0) <= 0) {
      errors.push('emc.contractYears must be greater than 0');
    }
  }

  if (branching.branchType && !branching.freezeReady) {
    errors.push('commercial freezeReady must be confirmed');
  }

  if (errors.length > 0) {
    return {
      calculationSummary: zeroCalculationSummary(),
      gateValidation: {
        canSnapshot: false,
        errors,
      },
    };
  }

  const baselineCoolingPowerKw = (normalized.baselineLoadRt * 3.517) / normalized.baselineCop;
  const targetCoolingPowerKw = (normalized.targetLoadRt * 3.517) / normalized.targetCop;
  const baselineAnnualEnergyKwh = baselineCoolingPowerKw * normalized.operatingHoursPerYear * normalized.systemLossFactor;
  const targetAnnualEnergyKwh = targetCoolingPowerKw * normalized.operatingHoursPerYear * normalized.systemLossFactor;
  const annualPowerSavingKwh = baselineAnnualEnergyKwh - targetAnnualEnergyKwh;
  const annualCostSavingCny = annualPowerSavingKwh * normalized.electricityPricePerKwh;
  const efficiencyImprovementRatio = baselineAnnualEnergyKwh > 0
    ? 1 - (targetAnnualEnergyKwh / baselineAnnualEnergyKwh)
    : 0;

  if (targetAnnualEnergyKwh >= baselineAnnualEnergyKwh) {
    return {
      calculationSummary: zeroCalculationSummary(),
      gateValidation: {
        canSnapshot: false,
        errors: ['target annual energy must be lower than baseline annual energy'],
      },
    };
  }

  return {
    calculationSummary: {
      baselineAnnualEnergyKwh: round2(baselineAnnualEnergyKwh),
      targetAnnualEnergyKwh: round2(targetAnnualEnergyKwh),
      annualPowerSavingKwh: round2(annualPowerSavingKwh),
      annualCostSavingCny: round2(annualCostSavingCny),
      efficiencyImprovementRatio: round2(efficiencyImprovementRatio),
      baselineCoolingPowerKw: round2(baselineCoolingPowerKw),
      targetCoolingPowerKw: round2(targetCoolingPowerKw),
    },
    gateValidation: {
      canSnapshot: true,
      errors: [],
    },
  };
}
