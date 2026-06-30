import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Zap,
} from 'lucide-react';

import {
  getProjectHvacSurveyWorkspace,
  getProjectSolutionWorkspace,
  listProjectSolutionSnapshots,
  type ProjectHvacSurveyWorkspace,
  type ProjectSolutionSnapshot,
  type ProjectSolutionWorkspace,
} from '../api/projects';
import type { Project, SurveyWorkflowView } from '../types/project';
import { SURVEY_WORKFLOW_LABELS } from '../types/project';
import {
  HVAC_DEVICE_TYPE_LABELS,
  HVAC_REVIEW_STATUS_LABELS,
} from '../utils/projectHvacSurveyWorkspace';

export type SurveyProjectTarget = {
  surveyTab?: 'overview' | 'stations' | 'files' | 'review' | 'assets' | 'modeling' | 'evaluation' | 'handoff';
  section?: 'solution';
};

interface Props {
  projects: Project[];
  loading: boolean;
  error?: string | null;
  activeModule: SurveyWorkflowView;
  onInitializeProject: () => void | Promise<void>;
  onSelectProject: (project: Project) => void;
  onOpenProjectModule: (project: Project, target: SurveyProjectTarget) => void;
}

interface ProjectSurveyBundle {
  project: Project;
  hvac: ProjectHvacSurveyWorkspace | null;
  solution: ProjectSolutionWorkspace | null;
  snapshots: ProjectSolutionSnapshot[];
  error: string | null;
}

type AliProjectStage = 1 | 2 | 3;

const ALI_STAGE_LABELS: Record<AliProjectStage, string> = {
  1: '数据收资',
  2: '能效评估',
  3: '方案生成',
};

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatKwh(value: number) {
  if (value >= 10000) {
    return `${formatNumber(value / 10000, 2)} 万kWh`;
  }

  return `${formatNumber(value, 0)} kWh`;
}

function formatCurrency(value: number) {
  if (value >= 10000) {
    return `${formatNumber(value / 10000, 2)} 万元`;
  }

  return `${formatNumber(value, 0)} 元`;
}

function formatPercent(value: number) {
  return `${formatNumber(value * 100, 2)}%`;
}

function getEvaluation(bundle: ProjectSurveyBundle) {
  return bundle.hvac?.latestEvaluation?.result ?? null;
}

function getApprovedAssets(bundle: ProjectSurveyBundle) {
  return bundle.hvac?.equipmentAssets.filter((asset) => asset.reviewStatus === 'approved') ?? [];
}

function getPendingReviewCount(bundle: ProjectSurveyBundle) {
  const files = bundle.hvac?.files.filter((file) => file.extractionStatus !== 'reviewed').length ?? 0;
  const assets = bundle.hvac?.equipmentAssets.filter((asset) => asset.reviewStatus === 'pending').length ?? 0;
  const records = bundle.hvac?.operationRecords.filter((record) => record.reviewStatus === 'pending').length ?? 0;
  return files + assets + records;
}

function hasCompleteStationAssets(bundle: ProjectSurveyBundle) {
  const stations = bundle.hvac?.stations ?? [];
  const approvedAssets = getApprovedAssets(bundle);
  if (stations.length === 0 || approvedAssets.length === 0) {
    return false;
  }

  return stations.every((station) => (
    approvedAssets.some((asset) => asset.stationId === station.id)
  ));
}

function getAliProjectStage(bundle: ProjectSurveyBundle): AliProjectStage {
  if (getEvaluation(bundle) || bundle.snapshots.length > 0) {
    return 3;
  }

  if (hasCompleteStationAssets(bundle)) {
    return 2;
  }

  return 1;
}

function getHasScheme(bundle: ProjectSurveyBundle) {
  return bundle.snapshots.length > 0 || (bundle.solution?.lastSnapshotVersion ?? 0) > 0;
}

function getProjectProgress(bundle: ProjectSurveyBundle) {
  const hvac = bundle.hvac;
  if (!hvac) {
    return 0;
  }

  const stage = getAliProjectStage(bundle);
  const approvedAssets = getApprovedAssets(bundle);
  const reviewedFiles = hvac.files.filter((file) => file.extractionStatus === 'reviewed').length;
  const reviewedRecords = hvac.operationRecords.filter((record) => record.reviewStatus === 'approved').length;
  const monthlyAssets = new Set(hvac.monthlyProfiles.map((profile) => profile.equipmentAssetId));
  const checks = [
    hvac.stations.length > 0,
    reviewedFiles > 0 || approvedAssets.length > 0,
    approvedAssets.length > 0,
    reviewedRecords > 0 || monthlyAssets.size > 0,
  ];
  const baseProgress = checks.filter(Boolean).length / 5;
  return Math.min(1, baseProgress + (stage > 1 ? 0.2 : 0) + (stage === 3 ? 0.2 : 0));
}

function getProjectAnnualEnergy(bundle: ProjectSurveyBundle) {
  return getEvaluation(bundle)?.yearEnergyBeforeKwh ?? bundle.solution?.calculationSummary.baselineAnnualEnergyKwh ?? 0;
}

function getProjectSaving(bundle: ProjectSurveyBundle) {
  const evaluation = getEvaluation(bundle);
  if (evaluation) {
    return {
      energy: evaluation.yearSavingEnergyKwh,
      rate: evaluation.yearSavingRate,
      cost: evaluation.yearSavingCostCny,
    };
  }

  const calculation = bundle.solution?.calculationSummary;
  return {
    energy: calculation?.annualPowerSavingKwh ?? 0,
    rate: calculation?.efficiencyImprovementRatio ?? 0,
    cost: calculation?.annualCostSavingCny ?? 0,
  };
}

function StatusBlock({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-[10px] uppercase tracking-[0.14em]">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

function ModuleShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {children}
      </div>
    </div>
  );
}

function ModuleActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  title,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) {
          return;
        }
        onClick();
      }}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
        disabled
          ? 'cursor-not-allowed border-slate-800 bg-slate-950/40 text-slate-600'
          : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-emerald-500/50 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProjectModuleActions({
  bundle,
  onOpenProjectModule,
}: {
  bundle: ProjectSurveyBundle;
  onOpenProjectModule: (project: Project, target: SurveyProjectTarget) => void;
}) {
  const stage = getAliProjectStage(bundle);
  const hasScheme = getHasScheme(bundle);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <ModuleActionButton
        icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
        label="数据收资"
        onClick={() => onOpenProjectModule(bundle.project, { surveyTab: 'files' })}
      />
      <ModuleActionButton
        icon={<Database className="h-3.5 w-3.5" />}
        label="数据审核"
        onClick={() => onOpenProjectModule(bundle.project, { surveyTab: 'review' })}
      />
      <ModuleActionButton
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        label="能效评估"
        disabled={stage < 2}
        title={stage < 2 ? '完成冷冻站和设备收资后进入能效评估' : undefined}
        onClick={() => onOpenProjectModule(bundle.project, { surveyTab: 'evaluation' })}
      />
      <ModuleActionButton
        icon={<FileText className="h-3.5 w-3.5" />}
        label={hasScheme ? '查看报告' : '方案生成'}
        disabled={stage !== 3}
        title={stage !== 3 ? '完成能效评估后进入方案生成' : undefined}
        onClick={() => onOpenProjectModule(bundle.project, { section: 'solution' })}
      />
    </div>
  );
}

function EmptyState({
  initializing,
  onInitializeProject,
}: {
  initializing: boolean;
  onInitializeProject: () => void | Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 px-6 py-12 text-center">
      <p className="text-sm text-slate-300">暂无踏勘项目</p>
      <button
        type="button"
        onClick={onInitializeProject}
        disabled={initializing}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {initializing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        初始化踏勘项目
      </button>
    </div>
  );
}

function ProjectFlowCard({
  bundle,
  onSelectProject,
  onOpenProjectModule,
}: {
  bundle: ProjectSurveyBundle;
  onSelectProject: (project: Project) => void;
  onOpenProjectModule: (project: Project, target: SurveyProjectTarget) => void;
}) {
  const hvac = bundle.hvac;
  const progress = getProjectProgress(bundle);
  const annualEnergy = getProjectAnnualEnergy(bundle);
  const stage = getAliProjectStage(bundle);
  const pendingFileNum = getPendingReviewCount(bundle);

  return (
    <div className="w-full rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-4 text-left transition-colors hover:border-slate-700 hover:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => onSelectProject(bundle.project)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-emerald-300"
          >
            {bundle.project.name}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>{bundle.project.project_code || bundle.project.id}</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
              {ALI_STAGE_LABELS[stage]}
            </span>
            {pendingFileNum > 0 ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                待审核 {pendingFileNum}
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-500">
          <div>项目进度 {formatPercent(progress)}</div>
          <div className="mt-1">年用电 {annualEnergy > 0 ? formatKwh(annualEnergy) : '--'}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <MiniStat label="冷冻站" value={String(hvac?.stations.length ?? 0)} />
        <MiniStat label="设备" value={String(getApprovedAssets(bundle).length)} />
        <MiniStat label="运行记录" value={String(hvac?.operationRecords.length ?? 0)} />
        <MiniStat label="年电量" value={annualEnergy > 0 ? formatKwh(annualEnergy) : '--'} />
        <MiniStat label="方案" value={getHasScheme(bundle) ? '已生成' : stage === 3 ? '可生成' : '未开放'} />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <ProjectModuleActions bundle={bundle} onOpenProjectModule={onOpenProjectModule} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function OverviewModule({
  bundles,
  onSelectProject,
  onOpenProjectModule,
}: {
  bundles: ProjectSurveyBundle[];
  onSelectProject: (project: Project) => void;
  onOpenProjectModule: (project: Project, target: SurveyProjectTarget) => void;
}) {
  const equipmentCount = bundles.reduce((sum, bundle) => sum + (bundle.hvac?.equipmentAssets.length ?? 0), 0);
  const pendingAudit = bundles.reduce((sum, bundle) => (
    sum + getPendingReviewCount(bundle)
  ), 0);
  const avgProgress = bundles.length
    ? bundles.reduce((sum, bundle) => sum + getProjectProgress(bundle), 0) / bundles.length
    : 0;
  const annualEnergy = bundles.reduce((sum, bundle) => sum + getProjectAnnualEnergy(bundle), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-5">
        <StatusBlock icon={<ClipboardList className="h-4 w-4" />} label="项目总数" value={String(bundles.length)} />
        <StatusBlock icon={<Database className="h-4 w-4" />} label="已识别设备" value={String(equipmentCount)} />
        <StatusBlock icon={<AlertTriangle className="h-4 w-4" />} label="待审核数据" value={String(pendingAudit)} />
        <StatusBlock icon={<CheckCircle2 className="h-4 w-4" />} label="收资进度" value={formatPercent(avgProgress)} />
        <StatusBlock icon={<Zap className="h-4 w-4" />} label="年空调用电量" value={annualEnergy > 0 ? formatKwh(annualEnergy) : '--'} />
      </div>
      <div className="space-y-3">
        {bundles.map((bundle) => (
          <ProjectFlowCard
            key={bundle.project.id}
            bundle={bundle}
            onSelectProject={onSelectProject}
            onOpenProjectModule={onOpenProjectModule}
          />
        ))}
      </div>
    </div>
  );
}

function DataCollectionModule({
  bundles,
  onSelectProject,
  onOpenProjectModule,
}: {
  bundles: ProjectSurveyBundle[];
  onSelectProject: (project: Project) => void;
  onOpenProjectModule: (project: Project, target: SurveyProjectTarget) => void;
}) {
  return (
    <div className="space-y-3">
      {bundles.map((bundle) => (
        <ProjectFlowCard
          key={bundle.project.id}
          bundle={bundle}
          onSelectProject={onSelectProject}
          onOpenProjectModule={onOpenProjectModule}
        />
      ))}
    </div>
  );
}

function DataAuditModule({
  bundles,
  onOpenProjectModule,
}: {
  bundles: ProjectSurveyBundle[];
  onOpenProjectModule: (project: Project, target: SurveyProjectTarget) => void;
}) {
  const auditRows = bundles.flatMap((bundle) => [
    ...(bundle.hvac?.files.map((file) => ({
      id: file.id,
      project: bundle.project,
      projectName: bundle.project.name,
      name: file.fileName,
      type: file.fileType,
      status: file.extractionStatus === 'reviewed' ? '已通过' : file.extractionStatus === 'failed' ? '识别失败' : '待审核',
      confidence: file.confidence,
    })) ?? []),
    ...(bundle.hvac?.equipmentAssets.map((asset) => ({
      id: asset.id,
      project: bundle.project,
      projectName: bundle.project.name,
      name: asset.equipmentName || asset.model || '未命名设备',
      type: HVAC_DEVICE_TYPE_LABELS[asset.deviceType],
      status: HVAC_REVIEW_STATUS_LABELS[asset.reviewStatus],
      confidence: asset.confidence,
    })) ?? []),
  ]);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
          <thead className="bg-slate-900 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">项目名称</th>
              <th className="px-4 py-3 font-medium">数据名称</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">置信度</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-300">
            {auditRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">暂无审核数据，可从下方项目入口进入审核工作台。</td>
              </tr>
            ) : auditRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{row.projectName}</td>
                <td className="px-4 py-3 text-white">{row.name}</td>
                <td className="px-4 py-3">{row.type}</td>
                <td className="px-4 py-3">{row.confidence === null ? '--' : formatPercent(row.confidence)}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">
                  <ModuleActionButton
                    icon={<Database className="h-3.5 w-3.5" />}
                    label="进入审核"
                    onClick={() => onOpenProjectModule(row.project, { surveyTab: 'review' })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {bundles.map((bundle) => (
          <button
            key={bundle.project.id}
            type="button"
            onClick={() => onOpenProjectModule(bundle.project, { surveyTab: 'review' })}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-left text-xs text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-white"
          >
            <span className="truncate">{bundle.project.name}</span>
            <span className="shrink-0 text-slate-500">进入数据审核</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EnergyEfficiencyModule({
  bundles,
  onSelectProject,
  onOpenProjectModule,
}: {
  bundles: ProjectSurveyBundle[];
  onSelectProject: (project: Project) => void;
  onOpenProjectModule: (project: Project, target: SurveyProjectTarget) => void;
}) {
  const evaluated = bundles.filter((bundle) => Boolean(getEvaluation(bundle)));
  const totalSaving = bundles.reduce((sum, bundle) => sum + getProjectSaving(bundle).energy, 0);
  const totalCost = bundles.reduce((sum, bundle) => sum + getProjectSaving(bundle).cost, 0);
  const avgRate = evaluated.length
    ? evaluated.reduce((sum, bundle) => sum + getProjectSaving(bundle).rate, 0) / evaluated.length
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <StatusBlock icon={<CheckCircle2 className="h-4 w-4" />} label="已评估项目" value={String(evaluated.length)} />
        <StatusBlock icon={<ClipboardList className="h-4 w-4" />} label="待评估项目" value={String(bundles.length - evaluated.length)} />
        <StatusBlock icon={<BarChart3 className="h-4 w-4" />} label="总节能潜力" value={formatKwh(totalSaving)} />
        <StatusBlock icon={<Zap className="h-4 w-4" />} label="年节省电费" value={formatCurrency(totalCost)} hint={`平均节能率 ${formatPercent(avgRate)}`} />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
          <thead className="bg-slate-900 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">项目名称</th>
              <th className="px-4 py-3 font-medium">设备数</th>
              <th className="px-4 py-3 font-medium">年用电量</th>
              <th className="px-4 py-3 font-medium">节能潜力</th>
              <th className="px-4 py-3 font-medium">节能率</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-300">
            {bundles.map((bundle) => {
              const saving = getProjectSaving(bundle);
              const evaluation = getEvaluation(bundle);
              const stage = getAliProjectStage(bundle);
              return (
                <tr key={bundle.project.id} className="cursor-pointer hover:bg-slate-900/60" onClick={() => onSelectProject(bundle.project)}>
                  <td className="px-4 py-3 text-white">{bundle.project.name}</td>
                  <td className="px-4 py-3">{bundle.hvac?.equipmentAssets.length ?? 0}</td>
                  <td className="px-4 py-3">{formatKwh(getProjectAnnualEnergy(bundle))}</td>
                  <td className="px-4 py-3">{formatKwh(saving.energy)}</td>
                  <td className="px-4 py-3">{formatPercent(saving.rate)}</td>
                  <td className="px-4 py-3">{evaluation ? '已完成' : '待评估'}</td>
                  <td className="px-4 py-3">
                    <ModuleActionButton
                      icon={<BarChart3 className="h-3.5 w-3.5" />}
                      label={evaluation ? '查看评估' : '开始评估'}
                      disabled={stage < 2}
                      title={stage < 2 ? '完成数据收资后进入能效评估' : undefined}
                      onClick={() => onOpenProjectModule(bundle.project, { surveyTab: 'evaluation' })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanGenerationModule({
  bundles,
  onSelectProject,
  onOpenProjectModule,
}: {
  bundles: ProjectSurveyBundle[];
  onSelectProject: (project: Project) => void;
  onOpenProjectModule: (project: Project, target: SurveyProjectTarget) => void;
}) {
  const snapshotCount = bundles.reduce((sum, bundle) => sum + bundle.snapshots.length, 0);
  const readyCount = bundles.filter((bundle) => getAliProjectStage(bundle) === 3).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <StatusBlock icon={<FileText className="h-4 w-4" />} label="报告总数" value={String(snapshotCount)} />
        <StatusBlock icon={<FileSpreadsheet className="h-4 w-4" />} label="待生成" value={String(Math.max(0, bundles.length - readyCount))} />
        <StatusBlock icon={<CheckCircle2 className="h-4 w-4" />} label="可生成" value={String(readyCount)} />
        <StatusBlock icon={<ClipboardList className="h-4 w-4" />} label="模板数" value="4 个" />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
          <thead className="bg-slate-900 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">项目名称</th>
              <th className="px-4 py-3 font-medium">已生成</th>
              <th className="px-4 py-3 font-medium">最近更新</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-300">
            {bundles.map((bundle) => {
              const stage = getAliProjectStage(bundle);
              return (
                <tr key={bundle.project.id} className="cursor-pointer hover:bg-slate-900/60" onClick={() => onSelectProject(bundle.project)}>
                  <td className="px-4 py-3 text-white">{bundle.project.name}</td>
                  <td className="px-4 py-3">{bundle.snapshots.length}</td>
                  <td className="px-4 py-3">{bundle.solution?.lastSnapshotAt ? new Date(bundle.solution.lastSnapshotAt).toLocaleString('zh-CN') : '--'}</td>
                  <td className="px-4 py-3">{stage === 3 ? (getHasScheme(bundle) ? '已生成' : '可生成') : '待完成能效评估'}</td>
                  <td className="px-4 py-3">
                    <ModuleActionButton
                      icon={<FileText className="h-3.5 w-3.5" />}
                      label={getHasScheme(bundle) ? '查看报告' : '生成方案'}
                      disabled={stage !== 3}
                      title={stage !== 3 ? '完成能效评估后进入方案生成' : undefined}
                      onClick={() => onOpenProjectModule(bundle.project, { section: 'solution' })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SurveyWorkflowPage({
  projects,
  loading,
  error = null,
  activeModule,
  onInitializeProject,
  onSelectProject,
  onOpenProjectModule,
}: Props) {
  const surveyProjects = useMemo(() => projects, [projects]);
  const [bundles, setBundles] = useState<ProjectSurveyBundle[]>([]);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const loadBundles = useCallback(async () => {
    if (surveyProjects.length === 0) {
      setBundles([]);
      return;
    }

    setBundleLoading(true);
    setBundleError(null);
    try {
      const nextBundles = await Promise.all(surveyProjects.map(async (project) => {
        try {
          const [hvac, solution, snapshots] = await Promise.all([
            getProjectHvacSurveyWorkspace(project.id),
            getProjectSolutionWorkspace(project.id),
            listProjectSolutionSnapshots(project.id),
          ]);
          return { project, hvac, solution, snapshots, error: null };
        } catch (err) {
          return {
            project,
            hvac: null,
            solution: null,
            snapshots: [],
            error: err instanceof Error ? err.message : '踏勘数据加载失败',
          };
        }
      }));
      setBundles(nextBundles);
      const firstError = nextBundles.find((bundle) => bundle.error)?.error;
      setBundleError(firstError ?? null);
    } finally {
      setBundleLoading(false);
    }
  }, [surveyProjects]);

  useEffect(() => {
    void loadBundles();
  }, [loadBundles]);

  const handleInitializeProject = async () => {
    setInitializing(true);
    try {
      await onInitializeProject();
    } finally {
      setInitializing(false);
    }
  };

  const pageTitle = SURVEY_WORKFLOW_LABELS[activeModule];

  if (error || bundleError) {
    return (
      <ModuleShell title={pageTitle}>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error || bundleError}
        </div>
      </ModuleShell>
    );
  }

  if (loading || bundleLoading) {
    return (
      <ModuleShell title={pageTitle}>
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      </ModuleShell>
    );
  }

  if (surveyProjects.length === 0) {
    return (
      <ModuleShell title={pageTitle}>
        <EmptyState initializing={initializing} onInitializeProject={handleInitializeProject} />
      </ModuleShell>
    );
  }

  const moduleContent: Record<SurveyWorkflowView, ReactNode> = {
    overview: (
      <OverviewModule
        bundles={bundles}
        onSelectProject={onSelectProject}
        onOpenProjectModule={onOpenProjectModule}
      />
    ),
    dataCollection: (
      <DataCollectionModule
        bundles={bundles}
        onSelectProject={onSelectProject}
        onOpenProjectModule={onOpenProjectModule}
      />
    ),
    dataAudit: <DataAuditModule bundles={bundles} onOpenProjectModule={onOpenProjectModule} />,
    energyEfficiency: (
      <EnergyEfficiencyModule
        bundles={bundles}
        onSelectProject={onSelectProject}
        onOpenProjectModule={onOpenProjectModule}
      />
    ),
    planGeneration: (
      <PlanGenerationModule
        bundles={bundles}
        onSelectProject={onSelectProject}
        onOpenProjectModule={onOpenProjectModule}
      />
    ),
  };

  return (
    <ModuleShell title={pageTitle}>
      {moduleContent[activeModule]}
    </ModuleShell>
  );
}
