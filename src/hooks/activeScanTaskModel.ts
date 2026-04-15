import type { ScanTask } from '../types/scanTask';

type BannerTone = 'slate' | 'cyan' | 'amber' | 'emerald' | 'rose';

export interface TaskStatusMeta {
  label: string;
  description: string;
  tone: BannerTone;
}

export interface RecentScanTaskSummary {
  id: string;
  name: string;
  modeLabel: string;
  countLabel: string;
  zoomLabel: string;
  createdAtLabel: string;
  isActive: boolean;
}

export interface ScanSessionRowSummary {
  id: string;
  mode: 'area' | 'address';
  label: string | null;
  zoom_level: number;
  total_count: number | null;
  created_at: string;
}

export function getTaskStatusMeta(task: ScanTask | null | undefined): TaskStatusMeta {
  if (!task) {
    return {
      label: '未开始',
      description: '先框选区域或搜索地址，然后创建扫描任务',
      tone: 'slate',
    };
  }

  switch (task.status) {
    case 'capturing':
      return {
        label: '截图中',
        description: '地图瓦片正在采集并写入任务',
        tone: 'cyan',
      };
    case 'detecting':
      return {
        label: '识别中',
        description: 'AI 正在分析截图并生成候选结果',
        tone: 'cyan',
      };
    case 'review_pending':
      return {
        label: '待审核',
        description: 'AI 已完成，等待确认候选结果',
        tone: 'amber',
      };
    case 'completed':
      return {
        label: '已完成',
        description: '当前任务已完成，可继续查看结果或管理企业',
        tone: 'emerald',
      };
    case 'capture_failed':
    case 'partial_failed':
      return {
        label: '部分失败',
        description: '任务存在失败项，需要重试或人工处理',
        tone: 'rose',
      };
    default:
      return {
        label: '待执行',
        description: '任务已创建，等待继续处理',
        tone: 'slate',
      };
  }
}

export function buildRecentScanTaskSummary({
  row,
  activeSessionId,
}: {
  row: ScanSessionRowSummary;
  activeSessionId: string | null;
}): RecentScanTaskSummary {
  return {
    id: row.id,
    name: row.label?.trim() || `扫描任务 ${row.id.slice(0, 8)}`,
    modeLabel: row.mode === 'address' ? '地址扫描' : '区域扫描',
    countLabel: `${row.total_count ?? 0} 张`,
    zoomLabel: `Z${row.zoom_level}`,
    createdAtLabel: new Date(row.created_at).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    isActive: row.id === activeSessionId,
  };
}
