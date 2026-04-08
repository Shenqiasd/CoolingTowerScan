import { useState } from 'react';
import {
  Camera, UserCheck, MapPin, FileText, Gavel,
  Wrench, ClipboardCheck, Activity, ChevronRight,
  Upload, Download, Database, FileBarChart,
  LayoutDashboard, ChevronDown,
} from 'lucide-react';
import type { SopPhase } from '../types/project';
import { SOP_PHASES, SOP_PHASE_LABELS } from '../types/project';
import type { PipelineStep, ScanSession } from '../types/pipeline';
import type { StatsData } from '../types/enterprise';

export type SidebarView = 'dashboard' | PipelineStep;

interface Props {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  activeStep: PipelineStep;
  onStepChange: (step: PipelineStep) => void;
  session: ScanSession;
  stats: StatsData;
  projectCounts: Record<SopPhase, number>;
  onImportEnterprise: () => void;
  onImportDetection: () => void;
  onExport: () => void;
  onReport: () => void;
}

const PHASE_ICONS: Record<SopPhase, typeof Camera> = {
  prospecting: Camera,
  qualification: UserCheck,
  survey: MapPin,
  proposal: FileText,
  bidding: Gavel,
  execution: Wrench,
  commissioning: ClipboardCheck,
  operations: Activity,
};

const PHASE_COLORS: Record<SopPhase, { bg: string; text: string; activeBg: string; activeBorder: string }> = {
  prospecting:    { bg: 'bg-indigo-600/20', text: 'text-indigo-400', activeBg: 'bg-indigo-600/15', activeBorder: 'border-indigo-500/30' },
  qualification:  { bg: 'bg-cyan-600/20', text: 'text-cyan-400', activeBg: 'bg-cyan-600/15', activeBorder: 'border-cyan-500/30' },
  survey:         { bg: 'bg-emerald-600/20', text: 'text-emerald-400', activeBg: 'bg-emerald-600/15', activeBorder: 'border-emerald-500/30' },
  proposal:       { bg: 'bg-amber-600/20', text: 'text-amber-400', activeBg: 'bg-amber-600/15', activeBorder: 'border-amber-500/30' },
  bidding:        { bg: 'bg-orange-600/20', text: 'text-orange-400', activeBg: 'bg-orange-600/15', activeBorder: 'border-orange-500/30' },
  execution:      { bg: 'bg-rose-600/20', text: 'text-rose-400', activeBg: 'bg-rose-600/15', activeBorder: 'border-rose-500/30' },
  commissioning:  { bg: 'bg-purple-600/20', text: 'text-purple-400', activeBg: 'bg-purple-600/15', activeBorder: 'border-purple-500/30' },
  operations:     { bg: 'bg-teal-600/20', text: 'text-teal-400', activeBg: 'bg-teal-600/15', activeBorder: 'border-teal-500/30' },
};

// Map pipeline steps to SOP phases for highlighting
const STEP_TO_PHASE: Record<PipelineStep, SopPhase> = {
  screenshot: 'prospecting',
  detection: 'prospecting',
  results: 'prospecting',
};

const PIPELINE_STEPS: PipelineStep[] = ['screenshot', 'detection', 'results'];
const STEP_LABELS: Record<PipelineStep, string> = {
  screenshot: '区域截图',
  detection: 'AI 识别',
  results: '数据总览',
};

export default function LifecycleSidebar({
  activeView,
  onViewChange,
  activeStep,
  onStepChange,
  session,
  stats,
  projectCounts,
  onImportEnterprise,
  onImportDetection,
  onExport,
  onReport,
}: Props) {
  const [expandedPhase, setExpandedPhase] = useState<SopPhase | null>(
    activeView !== 'dashboard' ? 'prospecting' : null
  );

  const isDashboard = activeView === 'dashboard';
  const activePhase = isDashboard ? null : STEP_TO_PHASE[activeStep];

  return (
    <div className="w-60 bg-slate-900/80 border-r border-slate-700/40 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-700/30">
        <h1 className="text-sm font-bold text-white tracking-wide">HVAC Delivery</h1>
        <p className="text-[10px] text-slate-500 mt-0.5">空调交付全流程数字化平台</p>
      </div>

      {/* Dashboard entry */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => onViewChange('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
            isDashboard
              ? 'bg-white/10 border border-white/20 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
            isDashboard ? 'bg-white/15 text-white' : 'bg-slate-800 text-slate-500'
          }`}>
            <LayoutDashboard className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium">项目看板</span>
        </button>
      </div>

      {/* SOP Phases */}
      <div className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-2">交付阶段</p>

        {SOP_PHASES.map((phase) => {
          const Icon = PHASE_ICONS[phase];
          const colors = PHASE_COLORS[phase];
          const isActive = activePhase === phase;
          const isExpanded = expandedPhase === phase;
          const count = projectCounts[phase] || 0;
          const hasSubSteps = phase === 'prospecting';

          return (
            <div key={phase}>
              <button
                onClick={() => {
                  if (hasSubSteps) {
                    const willExpand = !isExpanded;
                    setExpandedPhase(willExpand ? phase : null);
                    if (willExpand) {
                      // default to results sub-step when expanding
                      onViewChange(activeStep === 'screenshot' || activeStep === 'detection' || activeStep === 'results'
                        ? activeStep
                        : 'results');
                      onStepChange(activeStep === 'screenshot' || activeStep === 'detection' || activeStep === 'results'
                        ? activeStep
                        : 'results');
                    } else {
                      onViewChange('dashboard');
                    }
                  }
                  // other phases: no-op for now
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all group ${
                  isActive
                    ? `${colors.activeBg} border ${colors.activeBorder} text-white`
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                  isActive ? `${colors.bg} ${colors.text}` : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'
                }`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium">{SOP_PHASE_LABELS[phase]}</span>
                  {count > 0 && (
                    <p className={`text-[10px] mt-0.5 ${isActive ? colors.text : 'text-slate-500'}`}>
                      {count} 个项目
                    </p>
                  )}
                </div>
                {hasSubSteps && (
                  isExpanded
                    ? <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                    : <ChevronRight className="w-3 h-3 opacity-50 flex-shrink-0" />
                )}
              </button>

              {/* Sub-steps for prospecting */}
              {hasSubSteps && isExpanded && (
                <div className="ml-9 mt-0.5 space-y-0.5">
                  {PIPELINE_STEPS.map((step) => {
                    const isStepActive = activeStep === step && !isDashboard;
                    return (
                      <button
                        key={step}
                        onClick={() => {
                          onViewChange(step);
                          onStepChange(step);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded text-[11px] transition-colors ${
                          isStepActive
                            ? 'text-indigo-400 bg-indigo-600/10'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                        }`}
                      >
                        {STEP_LABELS[step]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Data Management */}
      <div className="px-3 py-3 border-t border-slate-700/30 space-y-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-2">数据管理</p>
        <button onClick={onImportEnterprise} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
          <Upload className="w-3.5 h-3.5" /> 导入企业
        </button>
        <button onClick={onImportDetection} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
          <Database className="w-3.5 h-3.5" /> 导入识别
        </button>
        <button onClick={onExport} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
          <Download className="w-3.5 h-3.5" /> 导出数据
        </button>
        <button onClick={onReport} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/10 transition-colors">
          <FileBarChart className="w-3.5 h-3.5" /> 分析报告
        </button>
      </div>
    </div>
  );
}
