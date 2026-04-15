import { resolvePrecisionPreset, type PrecisionPreset } from './PrecisionPreset.ts';

export interface TaskLaunchSummaryModel {
  taskName: string;
  presetLabel: string;
  screenshotCountLabel: string;
  gridLabel: string;
  captureTimeLabel: string;
  detectTimeLabel: string;
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) {
    return `约 ${seconds} 秒`;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `约 ${minutes} 分钟`;
}

export function buildTaskLaunchSummary(input: {
  taskName: string;
  preset: PrecisionPreset;
  preview: { rows: number; cols: number; total: number };
  delayMs: number;
}): TaskLaunchSummaryModel {
  const preset = resolvePrecisionPreset(input.preset);
  const captureSeconds = Math.max(1, Math.round((input.preview.total * input.delayMs) / 1000));
  const detectSeconds = Math.max(1, input.preview.total * 5);

  return {
    taskName: input.taskName || '未命名扫描任务',
    presetLabel: preset.label,
    screenshotCountLabel: `${input.preview.total} 张`,
    gridLabel: `${input.preview.rows} 行 × ${input.preview.cols} 列`,
    captureTimeLabel: formatSeconds(captureSeconds),
    detectTimeLabel: formatSeconds(detectSeconds),
  };
}
