import type { StatsData } from '../../types/enterprise.ts';

export interface DiscoveryOverviewCard {
  label: string;
  value: string;
  helper: string;
  tone: string;
}

export interface DiscoveryOverviewModel {
  cards: DiscoveryOverviewCard[];
  primaryHint: string;
}

export function buildDiscoveryOverviewModel(stats: StatsData): DiscoveryOverviewModel {
  const cards: DiscoveryOverviewCard[] = [
    {
      label: '扫描任务',
      value: String(stats.totalScanTasks),
      helper: '区域截图与地址识别累计任务数',
      tone: 'border-violet-500/20 bg-violet-500/10 text-violet-200',
    },
    {
      label: '待审核候选',
      value: String(stats.pendingReviewCandidates),
      helper: '需先在 AI 识别页确认有塔或驳回',
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    },
    {
      label: '已通过候选',
      value: String(stats.approvedCandidates),
      helper: '已完成审核，进入企业沉淀链路',
      tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    },
    {
      label: '待绑定企业',
      value: String(stats.needsBindingCandidates),
      helper: '区域候选需绑定企业后才能上传标注图',
      tone: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    },
    {
      label: '已沉淀企业',
      value: String(stats.totalEnterprises),
      helper: '已进入企业档案库的目标',
      tone: 'border-slate-700 bg-slate-900/70 text-white',
    },
    {
      label: '确认有塔企业',
      value: String(stats.confirmedCoolingTower),
      helper: '已确认存在冷却塔的企业',
      tone: 'border-emerald-600/20 bg-emerald-600/10 text-emerald-200',
    },
  ];

  let primaryHint = '当前没有待处理候选，可以回到数据总览继续筛选和沉淀企业。';
  if (stats.pendingReviewCandidates > 0) {
    primaryHint = `当前有 ${stats.pendingReviewCandidates} 个候选待审核，优先在 AI 识别页完成确认。`;
  } else if (stats.needsBindingCandidates > 0) {
    primaryHint = `当前有 ${stats.needsBindingCandidates} 个候选待绑定企业，先补齐绑定再上传标注图。`;
  }

  return {
    cards,
    primaryHint,
  };
}
