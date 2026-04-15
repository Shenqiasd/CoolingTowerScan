import type { StatsData } from '../../types/enterprise.ts';
import { buildDiscoveryOverviewModel } from './discoveryOverviewModel.ts';

interface Props {
  stats: StatsData;
}

export default function ResultsOverviewStrip({ stats }: Props) {
  const model = buildDiscoveryOverviewModel(stats);

  return (
    <div className="border-b border-slate-800 bg-slate-950/80 px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">结果总览</h3>
          <p className="mt-1 text-xs text-slate-400">{model.primaryHint}</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {model.cards.map((card) => (
          <div key={card.label} className={`rounded-xl border px-3 py-3 ${card.tone}`}>
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400/80">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold">{card.value}</div>
            <div className="mt-1 text-[11px] text-slate-400">{card.helper}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
