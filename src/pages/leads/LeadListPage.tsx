import { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ApiClientError } from '../../api/client';
import { listLeads, type LeadConfirmationStatus, type LeadListItem, type LeadPriority, type LeadStatus } from '../../api/leads';

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: '新建',
  pending_confirmation: '待双确认',
  qualified: '已合格',
  disqualified: '已淘汰',
  on_hold: '挂起',
  converted: '已转项目',
};

export default function LeadListPage() {
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [priority, setPriority] = useState<LeadPriority | ''>('');
  const [routeUnavailable, setRouteUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setRouteUnavailable(false);
      try {
        const nextItems = await listLeads({
          status: status || undefined,
          priority: priority || undefined,
          search: search.trim() || undefined,
        });
        if (!cancelled) {
          setItems(nextItems);
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          if (err instanceof ApiClientError && err.status === 404) {
            setRouteUnavailable(true);
            setError('Lead 读接口尚未接入到当前环境。');
          } else {
            setError(err instanceof Error ? err.message : 'Lead 列表加载失败。');
          }
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
  }, [priority, search, status]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-400">Lead Center</p>
        <div className="mt-2 flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Formal Leads</h2>
            <p className="mt-1 text-sm text-slate-400">销售与技术双确认之后，Lead 才能转成正式项目。</p>
          </div>
          <div className="grid min-w-[360px] grid-cols-3 gap-3">
            <MetricCard label="总 Lead" value={`${items.length}`} />
            <MetricCard label="待确认" value={`${items.filter((item) => item.status === 'pending_confirmation').length}`} />
            <MetricCard label="已合格" value={`${items.filter((item) => item.status === 'qualified').length}`} />
          </div>
        </div>
      </div>

      <div className="border-b border-slate-800 px-6 py-4">
        <label className="relative block max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索 Lead 名称或编号"
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-500/40"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as LeadStatus | '')}
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as LeadPriority | '')}
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
          >
            <option value="">全部优先级</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </div>
        {error && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${routeUnavailable ? 'border border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
            {error}
          </div>
        )}
      </div>

      <div className="space-y-3 px-6 py-5">
        {loading ? (
          <PanelMessage message="正在加载 Lead 列表..." />
        ) : routeUnavailable ? (
          <PanelMessage message="后端 `GET /v1/leads` 还未部署到当前环境，前端未使用任何假数据。" />
        ) : items.length === 0 ? (
          <PanelMessage message="当前没有可展示的 Lead。" />
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              to={`/leads/${item.id}`}
              className="block rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 transition hover:border-slate-700 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-medium text-white">{item.name}</h3>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                      {STATUS_LABELS[item.status]}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                      {item.priority}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>编号 {item.leadCode}</span>
                    <span>销售 {confirmationLabel(item.confirmations.find((entry) => entry.role === 'sales')?.status)}</span>
                    <span>技术 {confirmationLabel(item.confirmations.find((entry) => entry.role === 'technical')?.status)}</span>
                    <span>更新时间 {new Date(item.updatedAt).toLocaleString('zh-CN')}</span>
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

function confirmationLabel(status?: LeadConfirmationStatus) {
  if (!status) {
    return '未知';
  }

  return status === 'confirmed' ? '已确认' : status === 'rejected' ? '已拒绝' : '待确认';
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
