import { ChevronRight, Clock3 } from 'lucide-react';

import type { RecentScanTaskSummary } from '../../hooks/activeScanTaskModel';

interface Props {
  tasks: RecentScanTaskSummary[];
  onSelect: (taskId: string) => void;
}

export default function RecentTaskList({ tasks, onSelect }: Props) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-slate-800 bg-slate-950/80 px-4 py-3">
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent Tasks</div>
        <div className="mt-1 text-sm font-medium text-white">最近扫描任务</div>
      </div>
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
              task.isActive
                ? 'border-cyan-500/30 bg-cyan-500/10'
                : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{task.name}</div>
                <div className="mt-1 text-xs text-slate-400">{task.modeLabel}</div>
              </div>
              <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${task.isActive ? 'text-cyan-300' : 'text-slate-500'}`} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span>{task.countLabel}</span>
              <span>{task.zoomLabel}</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              {task.createdAtLabel}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
