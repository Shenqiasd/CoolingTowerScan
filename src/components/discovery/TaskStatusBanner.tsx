import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock3, Eye, Radar, ScanSearch } from 'lucide-react';

import type { TaskStatusMeta } from '../../hooks/activeScanTaskModel';
import type { ScanTask } from '../../types/scanTask';

interface Props {
  task: ScanTask | null | undefined;
  meta: TaskStatusMeta;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const TONE_STYLES = {
  slate: 'border-slate-800 bg-slate-950/90',
  cyan: 'border-cyan-500/30 bg-cyan-500/10',
  amber: 'border-amber-500/30 bg-amber-500/10',
  emerald: 'border-emerald-500/30 bg-emerald-500/10',
  rose: 'border-rose-500/30 bg-rose-500/10',
} as const;

export default function TaskStatusBanner({ task, meta, collapsed = false, onToggleCollapse }: Props) {
  const Icon = meta.tone === 'emerald'
    ? CheckCircle2
    : meta.tone === 'amber'
      ? Eye
      : meta.tone === 'rose'
        ? AlertTriangle
        : meta.tone === 'cyan'
          ? Radar
          : Clock3;

  if (collapsed) {
    return (
      <div className={`border-b px-4 py-2 ${TONE_STYLES[meta.tone]}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-medium text-white">
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </div>
          <div className="min-w-0 flex-1 text-xs text-slate-200">
            {task?.id ? `任务 ${task.id.slice(0, 8)} · ${task.screenshotCount} 张截图 · ${task.detectedCount} 张已识别` : meta.description}
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-xs text-white transition-colors hover:bg-black/20"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              展开
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`border-b px-4 py-3 ${TONE_STYLES[meta.tone]}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-medium text-white">
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="text-sm font-medium text-white">
            {task?.id ? `任务 ${task.id.slice(0, 8)}` : '尚未创建扫描任务'}
          </div>
          <div className="mt-0.5 text-xs text-slate-300">{meta.description}</div>
        </div>
        {task && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
            <BannerMetric icon={<ScanSearch className="h-3.5 w-3.5" />} label={task.mode === 'address' ? '地址扫描' : '区域扫描'} />
            <BannerMetric icon={<Clock3 className="h-3.5 w-3.5" />} label={`${task.screenshotCount} 张截图`} />
            <BannerMetric icon={<Radar className="h-3.5 w-3.5" />} label={`${task.detectedCount} 张已识别`} />
            <BannerMetric icon={<Eye className="h-3.5 w-3.5" />} label={`${task.reviewedCount} 张已审核`} />
          </div>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-xs text-white transition-colors hover:bg-black/20"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            收起
          </button>
        )}
      </div>
    </div>
  );
}

function BannerMetric({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-2.5 py-1">
      {icon}
      <span>{label}</span>
    </div>
  );
}
