import { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight, GitCompareArrows, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ApiClientError } from '../../api/client';
import { listCandidates, type CandidateListItem, type CandidateStatus } from '../../api/candidates';

const STATUS_LABELS: Record<CandidateStatus, string> = {
  new: '新建',
  under_review: '审核中',
  approved: '已批准',
  rejected: '已拒绝',
  needs_info: '待补充',
  converted: '已转 Lead',
};

const STATUS_COLORS: Record<CandidateStatus, string> = {
  new: 'bg-slate-700/60 text-slate-200',
  under_review: 'bg-cyan-500/15 text-cyan-300',
  approved: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-rose-500/15 text-rose-300',
  needs_info: 'bg-amber-500/15 text-amber-300',
  converted: 'bg-indigo-500/15 text-indigo-300',
};

export default function CandidateListPage() {
  const [items, setItems] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CandidateStatus | ''>('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const nextItems = await listCandidates({
          status: status || undefined,
          search: search.trim() || undefined,
        });
        if (!cancelled) {
          setItems(nextItems);
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(err instanceof Error ? err.message : 'Candidate 列表加载失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [search, status]);

  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-400">Qualification</p>
        <div className="mt-2 flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Candidate Center</h2>
            <p className="mt-1 text-sm text-slate-400">扫描线索先进入治理池，审核后才能创建正式 Lead。</p>
          </div>
          <div className="grid min-w-[360px] grid-cols-3 gap-3">
            <MetricCard label="总候选" value={String(items.length)} />
            <MetricCard label="已批准" value={String(counts.approved ?? 0)} />
            <MetricCard label="待补充" value={String(counts.needs_info ?? 0)} />
          </div>
        </div>
      </div>

      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索企业名或地址"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-500/40"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as CandidateStatus | '')}
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}
      </div>

      <div className="space-y-3 px-6 py-5">
        {loading ? (
          <PanelMessage message="正在加载 Candidate 列表..." />
        ) : items.length === 0 ? (
          <PanelMessage message="当前没有符合条件的 Candidate。" />
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              to={`/candidates/${item.id}`}
              className="block rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 transition hover:border-slate-700 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-medium text-white">{item.matchedEnterpriseName || item.candidateCode}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_COLORS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{item.matchedAddress || '未绑定地址'}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>编号 {item.candidateCode}</span>
                      <span>冷却塔 {item.coolingTowerCount} 处</span>
                      <span>置信度 {(item.confidenceScore * 100).toFixed(1)}%</span>
                      <span>创建于 {new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-300">
                      <GitCompareArrows className="h-3.5 w-3.5 text-cyan-300" />
                      进入详情处理重复匹配与审核
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function PanelMessage({ message }: { message: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-4 text-center">
      <AlertCircle className="h-8 w-8 text-slate-600" />
      <p className="mt-3 text-sm text-slate-400">{message}</p>
    </div>
  );
}
