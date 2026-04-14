import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowLeft, Loader2, ShieldCheck, Workflow } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiClientError } from '../../api/client';
import {
  confirmLead,
  getLead,
  listLeadAuditLogs,
  updateLead,
  type LeadConfirmationRole,
  type LeadDetail,
  type LeadAuditLogItem,
  type LeadPriority,
} from '../../api/leads';
import { createProject } from '../../api/projects';

export default function LeadDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId ?? '';

  const [item, setItem] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [commentByRole, setCommentByRole] = useState<Record<LeadConfirmationRole, string>>({
    sales: '',
    technical: '',
  });
  const [priority, setPriority] = useState<LeadPriority>('medium');
  const [nextAction, setNextAction] = useState('');
  const [riskSummary, setRiskSummary] = useState('');
  const [salesOwnerUserId, setSalesOwnerUserId] = useState('');
  const [technicalOwnerUserId, setTechnicalOwnerUserId] = useState('');
  const [auditLogs, setAuditLogs] = useState<LeadAuditLogItem[]>([]);
  const [projectName, setProjectName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setRouteUnavailable(false);
      try {
        const nextItem = await getLead(leadId);
        if (!cancelled) {
          setItem(nextItem);
          setPriority(nextItem.priority);
          setNextAction(nextItem.nextAction);
          setRiskSummary(nextItem.riskSummary);
          setSalesOwnerUserId(nextItem.salesOwnerUserId ?? '');
          setTechnicalOwnerUserId(nextItem.technicalOwnerUserId ?? '');
          setProjectName(nextItem.name);
          setCommentByRole({
            sales: nextItem.confirmations.find((entry) => entry.role === 'sales')?.comment ?? '',
            technical: nextItem.confirmations.find((entry) => entry.role === 'technical')?.comment ?? '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setItem(null);
          if (err instanceof ApiClientError && err.status === 404) {
            setRouteUnavailable(true);
            setError('Lead 详情接口尚未接入到当前环境。');
          } else {
            setError(err instanceof Error ? err.message : 'Lead 详情加载失败。');
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (leadId) {
      void run();
    } else {
      setLoading(false);
      setError('Lead id 缺失。');
    }

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;

    if (!leadId) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const items = await listLeadAuditLogs(leadId);
        if (!cancelled) {
          setAuditLogs(items);
        }
      } catch {
        if (!cancelled) {
          setAuditLogs([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leadId, item?.updatedAt]);

  const handleConfirm = async (role: LeadConfirmationRole, action: 'confirm' | 'reject') => {
    if (!item) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const nextItem = await confirmLead(item.id, {
        role,
        action,
        comment: commentByRole[role],
      });
      setItem(nextItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lead 确认失败。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProject = async () => {
    if (!item) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await createProject({
        leadId: item.id,
        name: projectName.trim() || item.name,
      });
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : '项目创建失败。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveLead = async () => {
    if (!item) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const nextItem = await updateLead(item.id, {
        priority,
        nextAction,
        riskSummary,
        salesOwnerUserId: salesOwnerUserId || null,
        technicalOwnerUserId: technicalOwnerUserId || null,
      });
      setItem(nextItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lead 更新失败。');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageMessage icon={<Loader2 className="h-8 w-8 animate-spin text-slate-500" />} message="正在加载 Lead 详情..." />;
  }

  if (!item) {
    return <PageMessage icon={<AlertCircle className="h-8 w-8 text-rose-300" />} message={error || 'Lead 不存在。'} />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-5">
        <Link to="/leads" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          返回 Lead 列表
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-400">Lead Detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{item.name}</h2>
            <p className="mt-2 text-sm text-slate-400">编号 {item.leadCode} · 状态 {item.status}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">优先级</p>
            <p className="mt-1 text-base font-medium text-white">{item.priority}</p>
            <p className="mt-2 text-xs text-slate-400">更新时间 {new Date(item.updatedAt).toLocaleString('zh-CN')}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-6 py-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-base font-medium text-white">Lead 基本信息</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-400">
                优先级
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as LeadPriority)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
              <label className="text-sm text-slate-400">
                销售 Owner
                <input
                  value={salesOwnerUserId}
                  onChange={(event) => setSalesOwnerUserId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
                />
              </label>
              <label className="text-sm text-slate-400">
                技术 Owner
                <input
                  value={technicalOwnerUserId}
                  onChange={(event) => setTechnicalOwnerUserId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
                />
              </label>
              <label className="text-sm text-slate-400 md:col-span-2">
                下一动作
                <input
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
                />
              </label>
              <label className="text-sm text-slate-400 md:col-span-2">
                风险摘要
                <textarea
                  value={riskSummary}
                  onChange={(event) => setRiskSummary(event.target.value)}
                  className="mt-2 min-h-[96px] w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
                />
              </label>
            </div>
            <button
              onClick={() => void handleSaveLead()}
              disabled={submitting}
              className="mt-4 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              保存 Lead 信息
            </button>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <h3 className="text-base font-medium text-white">双确认</h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(['sales', 'technical'] as LeadConfirmationRole[]).map((role) => {
                const confirmation = item.confirmations.find((entry) => entry.role === role);
                return (
                  <div key={role} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{role === 'sales' ? '销售确认' : '技术确认'}</p>
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                        {confirmation?.status ?? 'pending'}
                      </span>
                    </div>
                    <textarea
                      value={commentByRole[role]}
                      onChange={(event) => setCommentByRole((prev) => ({ ...prev, [role]: event.target.value }))}
                      placeholder="填写确认意见"
                      className="mt-3 min-h-[88px] w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/40"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => void handleConfirm(role, 'confirm')}
                        disabled={submitting}
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => void handleConfirm(role, 'reject')}
                        disabled={submitting}
                        className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        驳回
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-base font-medium text-white">资格摘要</h3>
            <pre className="mt-3 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs leading-6 text-slate-300">
              {JSON.stringify(item.qualificationSummary, null, 2)}
            </pre>
            <h3 className="mt-5 text-base font-medium text-white">来源快照</h3>
            <pre className="mt-3 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs leading-6 text-slate-300">
              {JSON.stringify(item.sourceSnapshot, null, 2)}
            </pre>
            <h3 className="mt-5 text-base font-medium text-white">审计轨迹</h3>
            <div className="mt-3 space-y-3">
              {auditLogs.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
                  当前没有可展示的 Lead audit 记录。
                </div>
              ) : auditLogs.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-white">{entry.action}</span>
                    <span className="text-slate-500">{new Date(entry.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">actor {entry.actorUserId || 'anonymous'} · source {entry.actorSource}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-cyan-300" />
              <h3 className="text-base font-medium text-white">项目引导</h3>
            </div>
            <p className="mt-2 text-sm text-slate-400">只有 `qualified` Lead 才允许创建项目，服务端会再次校验双确认状态。</p>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="项目名称"
              className="mt-4 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/40"
            />
            <button
              onClick={() => void handleCreateProject()}
              disabled={submitting || (item.status !== 'qualified' && item.status !== 'converted')}
              className="mt-4 w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {item.status === 'qualified' || item.status === 'converted' ? '创建项目' : '当前状态不可创建项目'}
            </button>
          </section>

          {routeUnavailable && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
              当前环境尚未部署 Lead 详情读接口，页面没有使用任何假数据。
            </section>
          )}
        </div>
      </div>

      {error && (
        <div className="px-6 pb-6">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

function PageMessage({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-950 px-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-8 py-10 text-center">
        <div className="flex justify-center">{icon}</div>
        <p className="mt-4 text-sm text-slate-300">{message}</p>
      </div>
    </div>
  );
}
