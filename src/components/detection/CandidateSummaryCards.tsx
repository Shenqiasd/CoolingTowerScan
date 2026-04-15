import { CheckCircle2, Link2, ShieldAlert, XCircle } from 'lucide-react';

import type { CandidateReviewStats } from './candidateReviewStats.ts';

interface Props {
  stats: CandidateReviewStats;
}

const CARDS = [
  {
    key: 'pendingReview',
    label: '待审核',
    icon: ShieldAlert,
    tone: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
    iconTone: 'text-amber-300',
  },
  {
    key: 'approved',
    label: '已通过',
    icon: CheckCircle2,
    tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100',
    iconTone: 'text-emerald-300',
  },
  {
    key: 'rejected',
    label: '已驳回',
    icon: XCircle,
    tone: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
    iconTone: 'text-rose-300',
  },
  {
    key: 'needsBinding',
    label: '待绑定企业',
    icon: Link2,
    tone: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100',
    iconTone: 'text-cyan-300',
  },
] as const;

export default function CandidateSummaryCards({ stats }: Props) {
  return (
    <div className="grid gap-2 border-b border-slate-800 bg-slate-950/70 px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];

        return (
          <div key={card.key} className={`rounded-xl border px-3 py-3 ${card.tone}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300/70">{card.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
              </div>
              <div className={`rounded-lg border border-white/10 bg-black/10 p-2 ${card.iconTone}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
