import { useState } from 'react';
import {
  Search, Plus, ChevronRight, Building2, Thermometer,
  TrendingUp, Clock, Filter,
} from 'lucide-react';
import type { Project, SopPhase } from '../types/project';
import { SOP_PHASES, SOP_PHASE_LABELS } from '../types/project';

interface Props {
  projects: Project[];
  loading: boolean;
  phaseFilter: SopPhase | '';
  onPhaseFilter: (phase: SopPhase | '') => void;
  onCreateFromEnterprise: () => void;
  onSelectProject: (project: Project) => void;
}

const PHASE_BADGE_COLORS: Record<SopPhase, string> = {
  prospecting:   'bg-indigo-500/20 text-indigo-300',
  qualification: 'bg-cyan-500/20 text-cyan-300',
  survey:        'bg-emerald-500/20 text-emerald-300',
  proposal:      'bg-amber-500/20 text-amber-300',
  bidding:       'bg-orange-500/20 text-orange-300',
  execution:     'bg-rose-500/20 text-rose-300',
  commissioning: 'bg-purple-500/20 text-purple-300',
  operations:    'bg-teal-500/20 text-teal-300',
};

const PRIORITY_COLORS = {
  high: 'bg-red-500/20 text-red-300',
  medium: 'bg-yellow-500/20 text-yellow-300',
  low: 'bg-slate-500/20 text-slate-400',
};

export default function ProjectDashboard({
  projects,
  loading,
  phaseFilter,
  onPhaseFilter,
  onCreateFromEnterprise,
  onSelectProject,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = projects.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Phase summary counts
  const phaseCounts = SOP_PHASES.reduce((acc, phase) => {
    acc[phase] = projects.filter((p) => p.current_phase === phase).length;
    return acc;
  }, {} as Record<SopPhase, number>);

  const totalActive = projects.filter((p) => p.status === 'active').length;
  const totalCompleted = projects.filter((p) => p.status === 'completed').length;
  const avgScore = projects.length > 0
    ? (projects.reduce((s, p) => s + p.opportunity_score, 0) / projects.length).toFixed(1)
    : '0';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">项目看板</h2>
            <p className="text-xs text-slate-500 mt-0.5">空调交付全流程项目管理</p>
          </div>
          <button
            onClick={onCreateFromEnterprise}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            从企业创建项目
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-900/60 rounded-lg px-4 py-3 border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase">进行中</p>
            <p className="text-xl font-bold text-white mt-1">{totalActive}</p>
          </div>
          <div className="bg-slate-900/60 rounded-lg px-4 py-3 border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase">已完成</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{totalCompleted}</p>
          </div>
          <div className="bg-slate-900/60 rounded-lg px-4 py-3 border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase">平均评分</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{avgScore}</p>
          </div>
          <div className="bg-slate-900/60 rounded-lg px-4 py-3 border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase">总项目</p>
            <p className="text-xl font-bold text-white mt-1">{projects.length}</p>
          </div>
        </div>
      </div>

      {/* Phase Pipeline Bar */}
      <div className="px-6 py-3 border-b border-slate-800 flex gap-1.5 overflow-x-auto">
        <button
          onClick={() => onPhaseFilter('')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
            !phaseFilter ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          全部 ({projects.length})
        </button>
        {SOP_PHASES.map((phase) => (
          <button
            key={phase}
            onClick={() => onPhaseFilter(phase)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              phaseFilter === phase
                ? PHASE_BADGE_COLORS[phase]
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {SOP_PHASE_LABELS[phase]} ({phaseCounts[phase]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="搜索项目名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
            加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Building2 className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">暂无项目</p>
            <p className="text-xs mt-1">从企业列表中选择企业创建项目</p>
          </div>
        ) : (
          filtered.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="w-full text-left bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-lg px-4 py-3 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {project.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      PHASE_BADGE_COLORS[project.current_phase]
                    }`}>
                      {SOP_PHASE_LABELS[project.current_phase]}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      PRIORITY_COLORS[project.priority]
                    }`}>
                      {project.priority === 'high' ? '高' : project.priority === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-[11px] text-slate-500">
                    {project.enterprise && (
                      <>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {project.enterprise.industry_category}
                        </span>
                        {project.enterprise.has_cooling_tower && (
                          <span className="flex items-center gap-1">
                            <Thermometer className="w-3 h-3" />
                            {project.enterprise.cooling_tower_count} 冷却塔
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          评分 {project.opportunity_score}
                        </span>
                      </>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(project.updated_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
