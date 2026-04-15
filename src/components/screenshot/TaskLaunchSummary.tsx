import type { TaskLaunchSummaryModel } from './taskLaunchSummaryModel.ts';

interface Props {
  summary: TaskLaunchSummaryModel;
}

export default function TaskLaunchSummary({ summary }: Props) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">Task Summary</div>
        <div className="mt-1 text-sm font-medium text-white">{summary.taskName}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <SummaryCell label="扫描预设" value={summary.presetLabel} />
        <SummaryCell label="截图数量" value={summary.screenshotCountLabel} />
        <SummaryCell label="网格规模" value={summary.gridLabel} />
        <SummaryCell label="截图耗时" value={summary.captureTimeLabel} />
      </div>
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
        AI 识别预计 {summary.detectTimeLabel}
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}
