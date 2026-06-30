import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Calculator,
  ClipboardCheck,
  Database,
  FileSearch,
  FileWarning,
  Gauge,
  Layers3,
  Loader2,
  Plus,
  Save,
  Trash2,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

import {
  deleteProjectCoolingStation,
  replaceProjectHvacEquipmentAssets,
  replaceProjectHvacMonthlyProfiles,
  runProjectHvacEvaluation,
  upsertProjectCoolingStation,
} from '../../api/projects';
import {
  createEmptyHvacEquipmentDraft,
  createHvacEquipmentDrafts,
  createHvacMonthlyProfileDrafts,
  HVAC_DEVICE_TYPE_LABELS,
  HVAC_REVIEW_STATUS_LABELS,
  HVAC_SAVING_MODE_LABELS,
  serializeHvacEquipmentDrafts,
  serializeHvacMonthlyProfileDrafts,
  type CoolingStationPayload,
  type HvacDeviceType,
  type HvacEquipmentAssetDraft,
  type HvacMonthlyProfileDraft,
  type HvacOperationStrategy,
  type HvacReviewStatus,
  type HvacSavingMode,
  type ProjectHvacSurveyWorkspace,
} from '../../utils/projectHvacSurveyWorkspace';
import type { EquipmentStatus } from '../../utils/projectSurveyWorkspace';

export type HvacTab =
  | 'overview'
  | 'stations'
  | 'files'
  | 'review'
  | 'assets'
  | 'modeling'
  | 'evaluation'
  | 'handoff';

const HVAC_TABS: Array<{ id: HvacTab; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: '概览', icon: Layers3 },
  { id: 'stations', label: '冷冻站', icon: Warehouse },
  { id: 'files', label: '资料收资', icon: FileSearch },
  { id: 'review', label: '识别审核', icon: ClipboardCheck },
  { id: 'assets', label: '设备台账', icon: Database },
  { id: 'modeling', label: '运行建模', icon: Gauge },
  { id: 'evaluation', label: '节能测算', icon: Calculator },
  { id: 'handoff', label: '缺口与交接', icon: FileWarning },
];

const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  unknown: '未知',
  running: '运行',
  standby: '备用',
  offline: '停用',
};

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);

interface HvacSurveyPanelProps {
  projectId: string;
  workspace: ProjectHvacSurveyWorkspace;
  initialTab?: HvacTab;
  onWorkspaceChange: (workspace: ProjectHvacSurveyWorkspace) => void;
  onAuditRefresh?: () => Promise<void>;
}

function formatNumber(value: number, fractionDigits = 0) {
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

function currentYear() {
  return new Date().getFullYear();
}

function emptyStationDraft(): CoolingStationPayload {
  return {
    name: '',
    locationLabel: '',
    notes: '',
  };
}

export function HvacSurveyPanel({
  projectId,
  workspace,
  initialTab = 'overview',
  onWorkspaceChange,
  onAuditRefresh,
}: HvacSurveyPanelProps) {
  const [activeTab, setActiveTab] = useState<HvacTab>(initialTab);
  const [stationDraft, setStationDraft] = useState<CoolingStationPayload>(emptyStationDraft());
  const [equipmentDrafts, setEquipmentDrafts] = useState<HvacEquipmentAssetDraft[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [modelYear, setModelYear] = useState(String(workspace.latestEvaluation?.year ?? currentYear()));
  const [monthlyDrafts, setMonthlyDrafts] = useState<HvacMonthlyProfileDraft[]>([]);
  const [savingMode, setSavingMode] = useState<HvacSavingMode>('balanced');
  const [electricityPricePerKwh, setElectricityPricePerKwh] = useState('');
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const [savingStation, setSavingStation] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [savingMonthly, setSavingMonthly] = useState(false);
  const [runningEvaluation, setRunningEvaluation] = useState(false);

  const approvedAssets = useMemo(
    () => workspace.equipmentAssets.filter((item) => item.reviewStatus === 'approved'),
    [workspace.equipmentAssets],
  );
  const defaultEquipmentId = approvedAssets[0]?.id ?? workspace.equipmentAssets[0]?.id ?? '';
  const selectedEquipment = workspace.equipmentAssets.find((item) => item.id === selectedEquipmentId) ?? null;
  const selectedModelYear = Number(modelYear) || currentYear();

  const monthlyCompleteCount = useMemo(() => (
    approvedAssets.filter((asset) => {
      const months = new Set(
        workspace.monthlyProfiles
          .filter((profile) => profile.equipmentAssetId === asset.id && profile.year === selectedModelYear)
          .map((profile) => profile.month),
      );
      return months.size === 12;
    }).length
  ), [approvedAssets, selectedModelYear, workspace.monthlyProfiles]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setEquipmentDrafts(createHvacEquipmentDrafts(workspace));
  }, [workspace]);

  useEffect(() => {
    if (!selectedEquipmentId && defaultEquipmentId) {
      setSelectedEquipmentId(defaultEquipmentId);
    }
  }, [defaultEquipmentId, selectedEquipmentId]);

  useEffect(() => {
    if (!selectedEquipmentId) {
      setMonthlyDrafts([]);
      return;
    }

    setMonthlyDrafts(createHvacMonthlyProfileDrafts(workspace, selectedEquipmentId, selectedModelYear));
  }, [selectedEquipmentId, selectedModelYear, workspace]);

  async function refreshAudit() {
    if (onAuditRefresh) {
      await onAuditRefresh();
    }
  }

  async function handleSaveStation() {
    if (!projectId) {
      return;
    }

    setSavingStation(true);
    setPanelError(null);
    setPanelNotice(null);
    try {
      const updated = await upsertProjectCoolingStation(projectId, stationDraft);
      onWorkspaceChange(updated);
      setStationDraft(emptyStationDraft());
      setPanelNotice('冷冻站已保存');
      await refreshAudit();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : '冷冻站保存失败');
    } finally {
      setSavingStation(false);
    }
  }

  async function handleDeleteStation(stationId: string) {
    setSavingStation(true);
    setPanelError(null);
    setPanelNotice(null);
    try {
      const updated = await deleteProjectCoolingStation(projectId, stationId);
      onWorkspaceChange(updated);
      if (stationDraft.id === stationId) {
        setStationDraft(emptyStationDraft());
      }
      setPanelNotice('冷冻站已删除');
      await refreshAudit();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : '冷冻站删除失败');
    } finally {
      setSavingStation(false);
    }
  }

  async function handleSaveEquipment() {
    setSavingEquipment(true);
    setPanelError(null);
    setPanelNotice(null);
    try {
      const updated = await replaceProjectHvacEquipmentAssets(
        projectId,
        serializeHvacEquipmentDrafts(equipmentDrafts),
      );
      onWorkspaceChange(updated);
      setPanelNotice('设备台账已保存');
      await refreshAudit();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : '设备台账保存失败');
    } finally {
      setSavingEquipment(false);
    }
  }

  async function handleSaveMonthlyProfiles() {
    if (!selectedEquipmentId) {
      setPanelError('请选择设备');
      return;
    }

    setSavingMonthly(true);
    setPanelError(null);
    setPanelNotice(null);
    try {
      const nextProfiles = [
        ...workspace.monthlyProfiles.filter((profile) => !(
          profile.equipmentAssetId === selectedEquipmentId
          && profile.year === selectedModelYear
        )),
        ...serializeHvacMonthlyProfileDrafts(monthlyDrafts),
      ];
      const updated = await replaceProjectHvacMonthlyProfiles(projectId, nextProfiles);
      onWorkspaceChange(updated);
      setPanelNotice('运行模型已保存');
      await refreshAudit();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : '运行模型保存失败');
    } finally {
      setSavingMonthly(false);
    }
  }

  async function handleRunEvaluation() {
    setRunningEvaluation(true);
    setPanelError(null);
    setPanelNotice(null);
    try {
      const price = electricityPricePerKwh.trim() ? Number(electricityPricePerKwh) : null;
      const updated = await runProjectHvacEvaluation(projectId, {
        year: selectedModelYear,
        savingMode,
        electricityPricePerKwh: Number.isFinite(price) ? price : null,
      });
      onWorkspaceChange(updated);
      setPanelNotice('节能测算已生成');
      await refreshAudit();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : '节能测算失败');
    } finally {
      setRunningEvaluation(false);
    }
  }

  function updateEquipmentDraft<K extends keyof HvacEquipmentAssetDraft>(
    index: number,
    key: K,
    value: HvacEquipmentAssetDraft[K],
  ) {
    setEquipmentDrafts((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  }

  function updateMonthlyDraft<K extends keyof HvacMonthlyProfileDraft>(
    index: number,
    key: K,
    value: HvacMonthlyProfileDraft[K],
  ) {
    setMonthlyDrafts((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-white">暖通探勘工作台</h4>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 ${workspace.gateValidation.canComplete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
              {workspace.gateValidation.canComplete ? '暖通门禁通过' : '暖通门禁未通过'}
            </span>
            <span className="text-slate-500">冷冻站 {workspace.stations.length}</span>
            <span className="text-slate-500">确认设备 {approvedAssets.length}</span>
            <span className="text-slate-500">12个月模型 {monthlyCompleteCount}/{approvedAssets.length}</span>
          </div>
        </div>
        {panelNotice ? (
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {panelNotice}
          </span>
        ) : null}
      </div>

      {panelError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {panelError}
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {HVAC_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white'
                  : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-cyan-500/50 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PanelMetric title="冷冻站" value={`${workspace.stations.length}`} hint="station" />
          <PanelMetric title="收资文件" value={`${workspace.files.length}`} hint="file" />
          <PanelMetric title="已确认设备" value={`${approvedAssets.length}`} hint="approved asset" />
          <PanelMetric title="测算版本" value={workspace.latestEvaluation ? `${workspace.latestEvaluation.year}` : '未生成'} hint={workspace.latestEvaluation ? HVAC_SAVING_MODE_LABELS[workspace.latestEvaluation.savingMode] : 'evaluation'} />
          <div className="md:col-span-2 xl:col-span-4">
            <GateErrorList errors={workspace.gateValidation.errors} />
          </div>
        </div>
      ) : null}

      {activeTab === 'stations' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            {workspace.stations.length === 0 ? (
              <EmptyState text="暂无冷冻站" />
            ) : workspace.stations.map((station) => (
              <div key={station.id} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{station.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{station.locationLabel || '未填写位置'}</p>
                    {station.notes ? <p className="mt-2 text-xs text-slate-400">{station.notes}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStationDraft({
                        id: station.id,
                        name: station.name,
                        locationLabel: station.locationLabel,
                        notes: station.notes,
                      })}
                      className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-white"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteStation(station.id)}
                      disabled={savingStation}
                      className="rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs text-rose-200 hover:border-rose-400/60 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="grid gap-3">
              <label className="space-y-2 text-xs text-slate-400">
                <span>冷冻站名称</span>
                <input
                  value={stationDraft.name}
                  onChange={(event) => setStationDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                />
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>位置</span>
                <input
                  value={stationDraft.locationLabel ?? ''}
                  onChange={(event) => setStationDraft((prev) => ({ ...prev, locationLabel: event.target.value }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                />
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>备注</span>
                <textarea
                  rows={3}
                  value={stationDraft.notes ?? ''}
                  onChange={(event) => setStationDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveStation()}
                  disabled={savingStation}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900/40"
                >
                  {savingStation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存冷冻站
                </button>
                <button
                  type="button"
                  onClick={() => setStationDraft(emptyStationDraft())}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
                >
                  新建
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'files' ? (
        <div className="space-y-3">
          {workspace.files.length === 0 ? (
            <EmptyState text="暂无收资文件" />
          ) : workspace.files.map((file) => (
            <div key={file.id} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="text-sm font-medium text-white">{file.fileName}</span>
                <span>{file.fileType}</span>
                <span>{file.extractionStatus}</span>
                <span>{formatNumber(file.fileSize)} bytes</span>
              </div>
              {file.errorMessage ? <p className="mt-2 text-xs text-rose-200">{file.errorMessage}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'review' ? (
        <div className="space-y-3">
          {workspace.operationRecords.length === 0 ? (
            <EmptyState text="暂无运行记录" />
          ) : workspace.operationRecords.map((record) => (
            <div key={record.id} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
              <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-4">
                <span>{record.recordDate ?? '未填日期'} {record.recordTime}</span>
                <span>运行 {record.operatingHours ?? 0}h</span>
                <span>负荷 {record.loadRatePct ?? 0}%</span>
                <span>{HVAC_REVIEW_STATUS_LABELS[record.reviewStatus]}</span>
              </div>
              {record.notes ? <p className="mt-2 text-xs text-slate-500">{record.notes}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'assets' ? (
        <div className="space-y-3">
          <div className="flex justify-between gap-3">
            <button
              type="button"
              onClick={() => setEquipmentDrafts((prev) => [
                ...prev,
                createEmptyHvacEquipmentDraft(workspace.stations[0]?.id ?? ''),
              ])}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              新增设备
            </button>
            <button
              type="button"
              onClick={() => void handleSaveEquipment()}
              disabled={savingEquipment}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900/40"
            >
              {savingEquipment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存设备
            </button>
          </div>
          {equipmentDrafts.length === 0 ? (
            <EmptyState text="暂无设备" />
          ) : equipmentDrafts.map((draft, index) => (
            <div key={draft.id || `draft-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                <SelectField label="冷冻站" value={draft.stationId} onChange={(value) => updateEquipmentDraft(index, 'stationId', value)}>
                  <option value="">未绑定</option>
                  {workspace.stations.map((station) => (
                    <option key={station.id} value={station.id}>{station.name}</option>
                  ))}
                </SelectField>
                <SelectField label="类型" value={draft.deviceType} onChange={(value) => updateEquipmentDraft(index, 'deviceType', value as HvacDeviceType)}>
                  {Object.entries(HVAC_DEVICE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </SelectField>
                <InputField label="设备名称" value={draft.equipmentName} onChange={(value) => updateEquipmentDraft(index, 'equipmentName', value)} />
                <InputField label="品牌" value={draft.brand} onChange={(value) => updateEquipmentDraft(index, 'brand', value)} />
                <InputField label="型号" value={draft.model} onChange={(value) => updateEquipmentDraft(index, 'model', value)} />
                <InputField label="数量" value={draft.quantity} onChange={(value) => updateEquipmentDraft(index, 'quantity', value)} />
                <InputField label="额定功率 kW" value={draft.ratedPowerKw} onChange={(value) => updateEquipmentDraft(index, 'ratedPowerKw', value)} />
                <InputField label="换热量 kW" value={draft.heatExchangeCapacityKw} onChange={(value) => updateEquipmentDraft(index, 'heatExchangeCapacityKw', value)} />
                <InputField label="冷量 kW" value={draft.ratedCoolingCapacityKw} onChange={(value) => updateEquipmentDraft(index, 'ratedCoolingCapacityKw', value)} />
                <InputField label="COP" value={draft.ratedCop} onChange={(value) => updateEquipmentDraft(index, 'ratedCop', value)} />
                <InputField label="扬程 m" value={draft.headM} onChange={(value) => updateEquipmentDraft(index, 'headM', value)} />
                <InputField label="流量 m3/h" value={draft.flowRateM3h} onChange={(value) => updateEquipmentDraft(index, 'flowRateM3h', value)} />
                <SelectField label="状态" value={draft.status} onChange={(value) => updateEquipmentDraft(index, 'status', value as EquipmentStatus)}>
                  {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </SelectField>
                <SelectField label="复核状态" value={draft.reviewStatus} onChange={(value) => updateEquipmentDraft(index, 'reviewStatus', value as HvacReviewStatus)}>
                  {Object.entries(HVAC_REVIEW_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </SelectField>
                <InputField label="置信度" value={draft.confidence} onChange={(value) => updateEquipmentDraft(index, 'confidence', value)} />
                <InputField label="备注" value={draft.notes} onChange={(value) => updateEquipmentDraft(index, 'notes', value)} />
              </div>
              <button
                type="button"
                onClick={() => setEquipmentDrafts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                className="mt-3 inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除设备
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'modeling' ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="设备" value={selectedEquipmentId} onChange={setSelectedEquipmentId}>
              <option value="">请选择设备</option>
              {workspace.equipmentAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.equipmentName || asset.model || asset.id}
                </option>
              ))}
            </SelectField>
            <InputField label="年份" value={modelYear} onChange={setModelYear} />
            <button
              type="button"
              onClick={() => void handleSaveMonthlyProfiles()}
              disabled={savingMonthly || !selectedEquipmentId}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900/40"
            >
              {savingMonthly ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存运行模型
            </button>
          </div>
          {selectedEquipment ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 text-xs text-slate-400">
                {selectedEquipment.equipmentName || selectedEquipment.model} · {HVAC_DEVICE_TYPE_LABELS[selectedEquipment.deviceType]}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {monthlyDrafts.map((draft, index) => (
                  <div key={draft.month} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-xs font-medium text-white">{MONTH_LABELS[index]}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <InputField label="运行台数" value={draft.runNum} onChange={(value) => updateMonthlyDraft(index, 'runNum', value)} />
                      <InputField label="月天数" value={draft.monthDays} onChange={(value) => updateMonthlyDraft(index, 'monthDays', value)} />
                      <InputField label="运行天数" value={draft.runDays} onChange={(value) => updateMonthlyDraft(index, 'runDays', value)} />
                      <InputField label="日小时" value={draft.runDayHours} onChange={(value) => updateMonthlyDraft(index, 'runDayHours', value)} />
                      <InputField label="负荷率%" value={draft.loadRatePct} onChange={(value) => updateMonthlyDraft(index, 'loadRatePct', value)} />
                      <SelectField label="策略" value={draft.operationStrategy} onChange={(value) => updateMonthlyDraft(index, 'operationStrategy', value as HvacOperationStrategy)}>
                        <option value="partial_year">部分运行</option>
                        <option value="full_year">全年运行</option>
                      </SelectField>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState text="请选择设备后建模" />
          )}
        </div>
      ) : null}

      {activeTab === 'evaluation' ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <InputField label="年份" value={modelYear} onChange={setModelYear} />
            <SelectField label="测算模式" value={savingMode} onChange={(value) => setSavingMode(value as HvacSavingMode)}>
              {Object.entries(HVAC_SAVING_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectField>
            <InputField label="电价 元/kWh" value={electricityPricePerKwh} onChange={setElectricityPricePerKwh} />
            <button
              type="button"
              onClick={() => void handleRunEvaluation()}
              disabled={runningEvaluation}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/40"
            >
              {runningEvaluation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
              运行测算
            </button>
          </div>
          {workspace.latestEvaluation ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <PanelMetric title="基线年耗电" value={`${formatNumber(workspace.latestEvaluation.result.yearEnergyBeforeKwh)} kWh`} />
                <PanelMetric title="优化后年耗电" value={`${formatNumber(workspace.latestEvaluation.result.yearEnergyAfterKwh)} kWh`} />
                <PanelMetric title="年节电量" value={`${formatNumber(workspace.latestEvaluation.result.yearSavingEnergyKwh)} kWh`} />
                <PanelMetric title="年节约电费" value={`${formatNumber(workspace.latestEvaluation.result.yearSavingCostCny)} 元`} />
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/70">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">月份</th>
                      <th className="px-3 py-2">基线 kWh</th>
                      <th className="px-3 py-2">优化 kWh</th>
                      <th className="px-3 py-2">节电 kWh</th>
                      <th className="px-3 py-2">节费</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {workspace.latestEvaluation.result.monthTrends.map((item) => (
                      <tr key={item.month}>
                        <td className="px-3 py-2">{item.month}月</td>
                        <td className="px-3 py-2">{formatNumber(item.energyBeforeKwh)}</td>
                        <td className="px-3 py-2">{formatNumber(item.energyAfterKwh)}</td>
                        <td className="px-3 py-2">{formatNumber(item.savingEnergyKwh)}</td>
                        <td className="px-3 py-2">{formatNumber(item.savingCostCny)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState text="暂无测算结果" />
          )}
        </div>
      ) : null}

      {activeTab === 'handoff' ? (
        <GateErrorList errors={workspace.gateValidation.errors} />
      ) : null}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2 text-xs text-slate-400">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2 text-xs text-slate-400">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function PanelMetric({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function GateErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
        暖通探勘门禁已满足
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {errors.map((error) => (
        <div key={error} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {error}
        </div>
      ))}
    </div>
  );
}
