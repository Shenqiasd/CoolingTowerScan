import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  FolderKanban,
  Handshake,
  ListChecks,
  Plus,
  Search,
  ShieldAlert,
  UserSquare2,
} from 'lucide-react';

import type { Project, SopPhase } from '../types/project';
import { SOP_PHASES, SOP_PHASE_LABELS } from '../types/project';
import { buildProjectWorkbenchSummary } from '../utils/projectWorkbench';

interface Props {
  projects: Project[];
  loading: boolean;
  phaseFilter: SopPhase | '';
  onPhaseFilter: (phase: SopPhase | '') => void;
  onCreateFromEnterprise: () => void;
  onSelectProject: (project: Project) => void;
}

const PHASE_BADGE_COLORS: Record<SopPhase, string> = {
  prospecting: 'bg-indigo-500/20 text-indigo-300',
  qualification: 'bg-cyan-500/20 text-cyan-300',
  survey: 'bg-emerald-500/20 text-emerald-300',
  proposal: 'bg-amber-500/20 text-amber-300',
  bidding: 'bg-orange-500/20 text-orange-300',
  execution: 'bg-rose-500/20 text-rose-300',
  commissioning: 'bg-purple-500/20 text-purple-300',
  operations: 'bg-teal-500/20 text-teal-300',
};

const PRIORITY_COLORS = {
  high: 'bg-red-500/20 text-red-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  low: 'bg-slate-500/20 text-slate-400',
} as const;

const STAGE_STATUS_LABELS = {
  not_started: '未开始',
  in_progress: '进行中',
  blocked: '阻塞',
  pending_approval: '待审批',
  completed: '已完成',
  waived: '已豁免',
} as const;

const COMMERCIAL_VISIBLE_PHASES: SopPhase[] = [
  'proposal',
  'bidding',
  'execution',
  'commissioning',
  'operations',
];

function getPhaseSnapshot(project: Project) {
  const value = project.phase_data[project.current_phase];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getProposalSolutionSnapshot(project: Project) {
  const proposalPhase = project.phase_data.proposal;
  const phaseValue = proposalPhase && typeof proposalPhase === 'object' && !Array.isArray(proposalPhase)
    ? proposalPhase as Record<string, unknown>
    : {};
  const workspace = phaseValue.solutionWorkspace;
  return workspace && typeof workspace === 'object' && !Array.isArray(workspace)
    ? workspace as Record<string, unknown>
    : {};
}

function getText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getCount(value: unknown[]) {
  return Array.isArray(value) ? value.length : 0;
}

function formatDueAt(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return '未设置';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString('zh-CN');
}

function getCommercialBranchLabel(value: unknown) {
  if (value === 'epc') {
    return 'EPC';
  }
  if (value === 'emc') {
    return 'EMC';
  }
  return '未选分支';
}

function getSolutionProgressLabel(project: Project) {
  if (!COMMERCIAL_VISIBLE_PHASES.includes(project.current_phase)) {
    return '尚未进入方案冻结';
  }

  const workspace = getProposalSolutionSnapshot(project);
  const branching = workspace.commercialBranching;
  const branchValue = branching && typeof branching === 'object' && !Array.isArray(branching)
    ? branching as Record<string, unknown>
    : {};
  const gateValidation = workspace.gateValidation;
  const gateValue = gateValidation && typeof gateValidation === 'object' && !Array.isArray(gateValidation)
    ? gateValidation as Record<string, unknown>
    : {};
  const lastSnapshotVersion = typeof workspace.lastSnapshotVersion === 'number'
    ? workspace.lastSnapshotVersion
    : 0;
  const errorCount = typeof gateValue.errorCount === 'number'
    ? gateValue.errorCount
    : 0;
  const canSnapshot = gateValue.canSnapshot === true;
  const freezeReady = branchValue.freezeReady === true;

  return `${getCommercialBranchLabel(branchValue.branchType)} · ${
    canSnapshot ? '可冻结' : `缺 ${errorCount} 项`
  } · ${freezeReady ? '已确认' : '待确认'} · V${lastSnapshotVersion}`;
}

export default function ProjectDashboard({
  projects,
  loading,
  phaseFilter,
  onPhaseFilter,
  onCreateFromEnterprise,
  onSelectProject,
}: Props) {
  const [search, setSearch] = useState('');

  const workbench = useMemo(() => buildProjectWorkbenchSummary(projects), [projects]);
  const phaseCounts = useMemo(() => SOP_PHASES.reduce((acc, phase) => {
    acc[phase] = projects.filter((project) => project.current_phase === phase).length;
    return acc;
  }, {} as Record<SopPhase, number>), [projects]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return projects;
    }

    return projects.filter((project) => (
      project.name.toLowerCase().includes(keyword)
      || (project.project_code ?? '').toLowerCase().includes(keyword)
    ));
  }, [projects, search]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">项目中心</h2>
            <p className="mt-0.5 text-xs text-slate-500">看项目节奏、待审批、阻塞和待交接项。</p>
          </div>
          <button
            onClick={onCreateFromEnterprise}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-500"
          >
            <Plus className="h-3.5 w-3.5" />
            前往项目转化入口
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="项目总数" value={String(projects.length)} accent="text-white" icon={<FolderKanban className="h-4 w-4" />} />
          <MetricCard label="待审批" value={String(workbench.waitingApproval)} accent="text-cyan-300" icon={<ShieldAlert className="h-4 w-4" />} />
          <MetricCard label="阻塞项" value={String(workbench.blocked)} accent="text-amber-300" icon={<AlertTriangle className="h-4 w-4" />} />
          <MetricCard label="已逾期" value={String(workbench.overdue)} accent="text-rose-300" icon={<Clock3 className="h-4 w-4" />} />
          <MetricCard label="待交接" value={String(workbench.pendingHandoffs)} accent="text-emerald-300" icon={<Handshake className="h-4 w-4" />} />
          <MetricCard label="进行中" value={String(projects.filter((project) => project.status === 'active').length)} accent="text-white" icon={<ListChecks className="h-4 w-4" />} />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-800 px-6 py-3">
        <button
          onClick={() => onPhaseFilter('')}
          className={`rounded-full px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
            !phaseFilter ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          全部 ({projects.length})
        </button>
        {SOP_PHASES.map((phase) => (
          <button
            key={phase}
            onClick={() => onPhaseFilter(phase)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
              phaseFilter === phase ? PHASE_BADGE_COLORS[phase] : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {SOP_PHASE_LABELS[phase]} ({phaseCounts[phase]})
          </button>
        ))}
      </div>

      <div className="px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="搜索项目名称或项目编号..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">项目加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center">
            <p className="text-sm text-slate-300">暂无项目</p>
            <p className="mt-1 text-xs text-slate-500">从已双确认 Lead 创建项目后会出现在这里。</p>
          </div>
        ) : (
          filtered.map((project) => {
            const snapshot = getPhaseSnapshot(project);
            const blockersCount = getCount(snapshot.blockers as unknown[]);
            const handoffsCount = getCount(snapshot.pendingHandoffs as unknown[]);
            const solutionSnapshot = getProposalSolutionSnapshot(project);
            const branching = solutionSnapshot.commercialBranching;
            const branchValue = branching && typeof branching === 'object' && !Array.isArray(branching)
              ? branching as Record<string, unknown>
              : {};

            return (
              <button
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="group w-full rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4 text-left transition-all hover:border-slate-700 hover:bg-slate-900/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">{project.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PHASE_BADGE_COLORS[project.current_phase]}`}>
                        {SOP_PHASE_LABELS[project.current_phase]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[project.priority]}`}>
                        {project.priority === 'high' ? '高' : project.priority === 'medium' ? '中' : '低'}
                      </span>
                      {COMMERCIAL_VISIBLE_PHASES.includes(project.current_phase) ? (
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                          {getCommercialBranchLabel(branchValue.branchType)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        {project.project_code || project.id}
                      </span>
                      <span>状态 {STAGE_STATUS_LABELS[project.current_stage_status ?? 'not_started']}</span>
                      <span>到期 {formatDueAt(snapshot.dueAt)}</span>
                      <span className="flex items-center gap-1">
                        <UserSquare2 className="h-3 w-3" />
                        {project.assigned_to || '未分配负责人'}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <DetailChip label="下一 Gate" value={getText(snapshot.nextGateLabel) || '待定义'} />
                      <DetailChip label="风险摘要" value={getText(snapshot.riskSummary) || '暂无风险摘要'} />
                      <DetailChip label="操作提醒" value={`阻塞 ${blockersCount} · 交接 ${handoffsCount}`} />
                      <DetailChip label="商业分支" value={getSolutionProgressLabel(project)} />
                    </div>
                  </div>

                  <ChevronRight className="mt-2 h-4 w-4 flex-shrink-0 text-slate-600 transition-colors group-hover:text-slate-300" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex items-center justify-between text-slate-500">
        <p className="text-[10px] uppercase tracking-[0.14em]">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-2 text-xs text-slate-300">{value}</p>
    </div>
  );
}
