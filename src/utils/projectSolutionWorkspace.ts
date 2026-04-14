export interface ProjectSolutionTechnicalAssumptions {
  baselineLoadRt: number | null;
  targetLoadRt: number | null;
  operatingHoursPerYear: number | null;
  electricityPricePerKwh: number | null;
  baselineCop: number | null;
  targetCop: number | null;
  systemLossFactor: number | null;
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

export interface ProjectSolutionWorkspaceDraft {
  projectId: string;
  technicalAssumptions: ProjectSolutionTechnicalAssumptionsDraft;
  calculationSummary: ProjectSolutionCalculationSummary;
  gateValidation: ProjectSolutionGateValidation;
  lastSnapshotVersion: number;
  lastSnapshotAt: string | null;
}

export interface ProjectSolutionWorkspacePayload {
  technicalAssumptions: ProjectSolutionTechnicalAssumptions;
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
  };
}
