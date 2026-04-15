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
