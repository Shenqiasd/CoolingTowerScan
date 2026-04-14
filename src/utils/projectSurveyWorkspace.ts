import type { SopPhase } from '../types/project.ts';

export type SurveyCompletionStatus = 'draft' | 'completed';
export type EquipmentStatus = 'unknown' | 'running' | 'standby' | 'offline';
export type DataGapType = 'missing_info' | 'risk' | 'waiver';
export type DataGapStatus = 'open' | 'resolved' | 'waived';
export type HandoffStatus = 'pending' | 'ready' | 'completed' | 'waived';

export interface SurveyInfoCollection {
  siteContactName: string;
  siteContactPhone: string;
  siteAccessWindow: string;
  operatingSchedule: string;
  coolingSystemType: string;
  powerAccessStatus: string;
  waterTreatmentStatus: string;
  notes: string;
}

export interface SurveyRecordData {
  surveyDate: string | null;
  surveyOwnerUserId: string | null;
  participantNames: string[];
  onSiteFindings: string;
  loadProfileSummary: string;
  retrofitConstraints: string;
  nextActions: string;
}

export interface EquipmentLedgerItem {
  id?: string;
  equipmentName: string;
  equipmentType: string;
  locationLabel: string;
  quantity: number;
  capacityRt: number;
  status: EquipmentStatus;
  notes: string;
}

export interface DataGapItem {
  id?: string;
  stageCode: SopPhase;
  gapType: DataGapType;
  title: string;
  detail: string;
  status: DataGapStatus;
  ownerUserId: string | null;
  dueAt: string | null;
  waiverReason: string;
}

export interface HandoffItem {
  id?: string;
  fromStage: SopPhase;
  toStage: SopPhase;
  title: string;
  detail: string;
  status: HandoffStatus;
  ownerUserId: string | null;
  dueAt: string | null;
}

export interface SurveyGateValidation {
  canComplete: boolean;
  errors: string[];
}

export interface ProjectSurveyWorkspace {
  projectId: string;
  infoCollection: SurveyInfoCollection;
  surveyRecord: SurveyRecordData;
  equipmentLedger: EquipmentLedgerItem[];
  dataGaps: DataGapItem[];
  handoffs: HandoffItem[];
  gateValidation: SurveyGateValidation;
  completionStatus: SurveyCompletionStatus;
  completedAt: string | null;
}

export interface SurveyRecordDraft {
  surveyDate: string;
  surveyOwnerUserId: string;
  participantNamesText: string;
  onSiteFindings: string;
  loadProfileSummary: string;
  retrofitConstraints: string;
  nextActions: string;
}

export interface EquipmentLedgerDraftItem {
  id?: string;
  equipmentName: string;
  equipmentType: string;
  locationLabel: string;
  quantity: string;
  capacityRt: string;
  status: EquipmentStatus;
  notes: string;
}

export interface DataGapDraftItem {
  id?: string;
  stageCode: SopPhase;
  gapType: DataGapType;
  title: string;
  detail: string;
  status: DataGapStatus;
  ownerUserId: string;
  dueAt: string;
  waiverReason: string;
}

export interface HandoffDraftItem {
  id?: string;
  fromStage: SopPhase;
  toStage: SopPhase;
  title: string;
  detail: string;
  status: HandoffStatus;
  ownerUserId: string;
  dueAt: string;
}

export interface ProjectSurveyWorkspaceDraft {
  projectId: string;
  infoCollection: SurveyInfoCollection;
  surveyRecord: SurveyRecordDraft;
  equipmentLedger: EquipmentLedgerDraftItem[];
  dataGaps: DataGapDraftItem[];
  handoffs: HandoffDraftItem[];
  gateValidation: SurveyGateValidation;
  completionStatus: SurveyCompletionStatus;
  completedAt: string | null;
}

export interface ProjectSurveyWorkspacePayload {
  infoCollection: SurveyInfoCollection;
  surveyRecord: SurveyRecordData;
  equipmentLedger: EquipmentLedgerItem[];
  dataGaps: DataGapItem[];
  handoffs: HandoffItem[];
}

function cleanText(value: string) {
  return value.trim();
}

function cleanOptionalText(value: string) {
  const text = cleanText(value);
  return text || null;
}

function splitTextLines(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createDefaultInfoCollection(): SurveyInfoCollection {
  return {
    siteContactName: '',
    siteContactPhone: '',
    siteAccessWindow: '',
    operatingSchedule: '',
    coolingSystemType: '',
    powerAccessStatus: '',
    waterTreatmentStatus: '',
    notes: '',
  };
}

function createDefaultSurveyRecord(): SurveyRecordData {
  return {
    surveyDate: null,
    surveyOwnerUserId: null,
    participantNames: [],
    onSiteFindings: '',
    loadProfileSummary: '',
    retrofitConstraints: '',
    nextActions: '',
  };
}

export function createDefaultSurveyWorkspace(projectId: string): ProjectSurveyWorkspace {
  return {
    projectId,
    infoCollection: createDefaultInfoCollection(),
    surveyRecord: createDefaultSurveyRecord(),
    equipmentLedger: [],
    dataGaps: [],
    handoffs: [],
    gateValidation: {
      canComplete: false,
      errors: [],
    },
    completionStatus: 'draft',
    completedAt: null,
  };
}

export function createEmptyEquipmentDraftItem(): EquipmentLedgerDraftItem {
  return {
    equipmentName: '',
    equipmentType: '',
    locationLabel: '',
    quantity: '1',
    capacityRt: '0',
    status: 'unknown',
    notes: '',
  };
}

export function createEmptyDataGapDraftItem(): DataGapDraftItem {
  return {
    stageCode: 'survey',
    gapType: 'missing_info',
    title: '',
    detail: '',
    status: 'open',
    ownerUserId: '',
    dueAt: '',
    waiverReason: '',
  };
}

export function createEmptyHandoffDraftItem(): HandoffDraftItem {
  return {
    fromStage: 'survey',
    toStage: 'proposal',
    title: '',
    detail: '',
    status: 'pending',
    ownerUserId: '',
    dueAt: '',
  };
}

export function createSurveyWorkspaceDraft(workspace: ProjectSurveyWorkspace): ProjectSurveyWorkspaceDraft {
  return {
    projectId: workspace.projectId,
    infoCollection: {
      ...workspace.infoCollection,
    },
    surveyRecord: {
      surveyDate: workspace.surveyRecord.surveyDate ?? '',
      surveyOwnerUserId: workspace.surveyRecord.surveyOwnerUserId ?? '',
      participantNamesText: workspace.surveyRecord.participantNames.join('\n'),
      onSiteFindings: workspace.surveyRecord.onSiteFindings,
      loadProfileSummary: workspace.surveyRecord.loadProfileSummary,
      retrofitConstraints: workspace.surveyRecord.retrofitConstraints,
      nextActions: workspace.surveyRecord.nextActions,
    },
    equipmentLedger: workspace.equipmentLedger.map((item) => ({
      ...item,
      quantity: String(item.quantity),
      capacityRt: String(item.capacityRt),
    })),
    dataGaps: workspace.dataGaps.map((item) => ({
      ...item,
      ownerUserId: item.ownerUserId ?? '',
      dueAt: item.dueAt ?? '',
    })),
    handoffs: workspace.handoffs.map((item) => ({
      ...item,
      ownerUserId: item.ownerUserId ?? '',
      dueAt: item.dueAt ?? '',
    })),
    gateValidation: workspace.gateValidation,
    completionStatus: workspace.completionStatus,
    completedAt: workspace.completedAt,
  };
}

export function serializeSurveyWorkspaceDraft(
  draft: ProjectSurveyWorkspaceDraft,
): ProjectSurveyWorkspacePayload {
  return {
    infoCollection: {
      siteContactName: cleanText(draft.infoCollection.siteContactName),
      siteContactPhone: cleanText(draft.infoCollection.siteContactPhone),
      siteAccessWindow: cleanText(draft.infoCollection.siteAccessWindow),
      operatingSchedule: cleanText(draft.infoCollection.operatingSchedule),
      coolingSystemType: cleanText(draft.infoCollection.coolingSystemType),
      powerAccessStatus: cleanText(draft.infoCollection.powerAccessStatus),
      waterTreatmentStatus: cleanText(draft.infoCollection.waterTreatmentStatus),
      notes: cleanText(draft.infoCollection.notes),
    },
    surveyRecord: {
      surveyDate: cleanOptionalText(draft.surveyRecord.surveyDate),
      surveyOwnerUserId: cleanOptionalText(draft.surveyRecord.surveyOwnerUserId),
      participantNames: splitTextLines(draft.surveyRecord.participantNamesText),
      onSiteFindings: cleanText(draft.surveyRecord.onSiteFindings),
      loadProfileSummary: cleanText(draft.surveyRecord.loadProfileSummary),
      retrofitConstraints: cleanText(draft.surveyRecord.retrofitConstraints),
      nextActions: cleanText(draft.surveyRecord.nextActions),
    },
    equipmentLedger: draft.equipmentLedger.map((item) => ({
      id: item.id,
      equipmentName: cleanText(item.equipmentName),
      equipmentType: cleanText(item.equipmentType),
      locationLabel: cleanText(item.locationLabel),
      quantity: toNumber(item.quantity),
      capacityRt: toNumber(item.capacityRt),
      status: item.status,
      notes: cleanText(item.notes),
    })),
    dataGaps: draft.dataGaps.map((item) => ({
      id: item.id,
      stageCode: item.stageCode,
      gapType: item.gapType,
      title: cleanText(item.title),
      detail: cleanText(item.detail),
      status: item.status,
      ownerUserId: cleanOptionalText(item.ownerUserId),
      dueAt: cleanOptionalText(item.dueAt),
      waiverReason: cleanText(item.waiverReason),
    })),
    handoffs: draft.handoffs.map((item) => ({
      id: item.id,
      fromStage: item.fromStage,
      toStage: item.toStage,
      title: cleanText(item.title),
      detail: cleanText(item.detail),
      status: item.status,
      ownerUserId: cleanOptionalText(item.ownerUserId),
      dueAt: cleanOptionalText(item.dueAt),
    })),
  };
}
