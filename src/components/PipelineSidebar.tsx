import { Camera, Radar, BarChart3, Database, Upload, Download, FileText, ChevronRight } from 'lucide-react';
import type { PipelineStep, ScanSession } from '../types/pipeline';
import type { StatsData } from '../types/enterprise';

interface Props {
  activeStep: PipelineStep;
  onStepChange: (step: PipelineStep) => void;
  session: ScanSession;
  stats: StatsData;
  onImportEnterprise: () => void;
  onImportDetection: () => void;
  onExport: () => void;
  onReport: () => void;
}

const STEPS: Array<{
  id: PipelineStep;
  label: string;
  icon: typeof Camera;
  getCount: (s: ScanSession, stats: StatsData) => string;
}> = [
  {
    id: 'screenshot',
    label: '区域截图',
    icon: Camera,
    getCount: (s) => s.screenshots.length > 0 ? `${s.screenshots.length} 张` : '',
  },
  {
    id: 'detection',
    label: 'AI 识别',
    icon: Radar,
    getCount: (s, stats) => {
      if (stats.pendingReviewCandidates > 0) {
        return `${stats.pendingReviewCandidates} 个待审核`;
      }
      const towers = s.detections.reduce((sum, d) => sum + d.count, 0);
      return towers > 0 ? `${towers} 个冷却塔` : s.detections.length > 0 ? `${s.detections.length} 张已识别` : '';
    },
  },
  {
    id: 'results',
    label: '数据总览',
    icon: BarChart3,
    getCount: (_, stats) => {
      if (stats.needsBindingCandidates > 0) {
        return `${stats.needsBindingCandidates} 个待绑定`;
      }
      return stats.totalEnterprises > 0 ? `${stats.totalEnterprises} 家企业` : '';
    },
  },
];

export default function PipelineSidebar({
  activeStep,
  onStepChange,
  session,
  stats,
  onImportEnterprise,
  onImportDetection,
  onExport,
  onReport,
}: Props) {
  const stepIndex = STEPS.findIndex(s => s.id === activeStep);

  return (
    <div className="w-56 bg-slate-900/80 border-r border-slate-700/40 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-700/30">
        <h1 className="text-sm font-bold text-white tracking-wide">CoolingTowerScan</h1>
        <p className="text-[10px] text-slate-500 mt-0.5">冷却塔识别全链路系统</p>
      </div>

      {/* Pipeline Steps */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-2">工作流程</p>

        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          const isCompleted = i < stepIndex;
          const count = step.getCount(session, stats);

          return (
            <button
              key={step.id}
              onClick={() => onStepChange(step.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
                isActive
                  ? 'bg-cyan-600/15 border border-cyan-500/30 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              {/* Step number / icon */}
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                isActive
                  ? 'bg-cyan-600/30 text-cyan-400'
                  : isCompleted
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium">{step.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 text-cyan-400" />}
                </div>
                {count && (
                  <p className={`text-[10px] mt-0.5 truncate ${
                    isActive ? 'text-cyan-400/70' : 'text-slate-500'
                  }`}>{count}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Data Management */}
      <div className="px-3 py-3 border-t border-slate-700/30 space-y-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-2">数据管理</p>

        <button
          onClick={onImportEnterprise}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          导入企业
        </button>

        <button
          onClick={onImportDetection}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <Database className="w-3.5 h-3.5" />
          导入识别
        </button>

        <button
          onClick={onExport}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          导出数据
        </button>

        <button
          onClick={onReport}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/10 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          分析报告
        </button>
      </div>
    </div>
  );
}
