import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  GitCompareArrows,
  Loader2,
  MapPin,
  Radar,
  Thermometer,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiClientError } from '../../api/client';
import {
  getCandidate,
  listCandidateDuplicates,
  markCandidateDuplicate,
  reviewCandidate,
  type CandidateDetail,
  type CandidateDuplicateItem,
  type CandidateReviewAction,
} from '../../api/candidates';
import { createLead } from '../../api/leads';

export default function CandidateDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ candidateId: string }>();
  const candidateId = params.candidateId ?? '';

  const [item, setItem] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [leadName, setLeadName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<CandidateDuplicateItem[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(true);
  const [duplicateRouteUnavailable, setDuplicateRouteUnavailable] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [selectedDuplicateId, setSelectedDuplicateId] = useState('');
  const [duplicateNote, setDuplicateNote] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const nextItem = await getCandidate(candidateId);
        if (!cancelled) {
          setItem(nextItem);
          setReviewNote(nextItem.reviewNote);
          setLeadName(nextItem.matchedEnterpriseName || nextItem.candidateCode);
        }
      } catch (err) {
        if (!cancelled) {
          setItem(null);
          setError(err instanceof Error ? err.message : 'Candidate 详情加载失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (candidateId) {
      void run();
    } else {
      setLoading(false);
      setError('Candidate id 缺失。');
    }

    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setDuplicatesLoading(true);
      setDuplicateError('');
      setDuplicateRouteUnavailable(false);
      try {
        const items = await listCandidateDuplicates(candidateId);
        if (!cancelled) {
          setDuplicates(items);
          setSelectedDuplicateId((current) => current || items[0]?.id || '');
        }
      } catch (err) {
        if (!cancelled) {
          setDuplicates([]);
          if (err instanceof ApiClientError && err.status === 404) {
            setDuplicateRouteUnavailable(true);
          } else {
            setDuplicateError(err instanceof Error ? err.message : '重复匹配加载失败。');
          }
        }
      } finally {
        if (!cancelled) {
          setDuplicatesLoading(false);
        }
      }
    };

    if (candidateId) {
      void run();
    } else {
      setDuplicatesLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const hvacMetrics = useMemo(() => {
    const snapshot = item?.hvacEstimateSnapshot ?? {};
    const readNumber = (...keys: string[]) => {
      for (const key of keys) {
        const value = snapshot[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
      }
      return null;
    };

    return {
      estimatedCapacityRt: readNumber('estimatedCapacityRt', 'estimated_capacity_rt', 'totalCoolingCapacityRt'),
      estimatedPowerKw: readNumber('estimatedCoolingStationPowerKw', 'estimated_cooling_station_power_kw', 'coolingStationPowerKw'),
      totalAreaM2: readNumber('totalTowerAreaM2', 'total_tower_area_m2', 'detectedTowerTotalAreaM2'),
    };
  }, [item]);

  const evidenceKinds = useMemo(() => {
    const groups = new Map<string, number>();
    for (const evidence of item?.evidences ?? []) {
      groups.set(evidence.kind, (groups.get(evidence.kind) ?? 0) + 1);
    }
    return Array.from(groups.entries());
  }, [item]);

  const confidenceLevel = useMemo(() => {
    const value = item?.confidenceScore ?? 0;
    if (value >= 0.85) return { label: '高可信', tone: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' };
    if (value >= 0.6) return { label: '中等可信', tone: 'text-amber-300 bg-amber-500/15 border-amber-500/30' };
    return { label: '低可信', tone: 'text-rose-300 bg-rose-500/15 border-rose-500/30' };
  }, [item]);

  const handleReview = async (action: CandidateReviewAction) => {
    if (!item) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const nextItem = await reviewCandidate(item.id, {
        action,
        note: reviewNote,
      });
      setItem(nextItem);
      setReviewNote(nextItem.reviewNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Candidate 审核失败。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLead = async () => {
    if (!item) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const lead = await createLead({
        candidateId: item.id,
        name: leadName.trim() || item.matchedEnterpriseName || item.candidateCode,
      });
      navigate(`/leads/${lead.id}`);
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Lead 创建失败。';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDuplicate = async () => {
    if (!item || !selectedDuplicateId) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const nextItem = await markCandidateDuplicate(item.id, {
        targetCandidateId: selectedDuplicateId,
        note: duplicateNote.trim(),
      });
      setItem(nextItem);
      setReviewNote(nextItem.reviewNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重复项标记失败。');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageMessage icon={<Loader2 className="h-8 w-8 animate-spin text-slate-500" />} message="正在加载 Candidate 详情..." />;
  }

  if (!item) {
    return <PageMessage icon={<AlertCircle className="h-8 w-8 text-rose-300" />} message={error || 'Candidate 不存在。'} />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-5">
        <Link to="/candidates" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          返回 Candidate 列表
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-400">Candidate Detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{item.matchedEnterpriseName || item.candidateCode}</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <MapPin className="h-4 w-4" />
              {item.matchedAddress || '未绑定地址'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">状态</p>
            <p className="mt-1 text-base font-medium text-white">{item.status}</p>
            <p className="mt-2 text-xs text-slate-400">编号 {item.candidateCode}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-6 py-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <h3 className="text-base font-medium text-white">审核动作</h3>
            </div>
            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="记录审核说明、补充要求或驳回原因"
              className="mt-4 min-h-[120px] w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/40"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton disabled={submitting} label="批准" onClick={() => void handleReview('approve')} tone="emerald" />
              <ActionButton disabled={submitting} label="待补充" onClick={() => void handleReview('needs_info')} tone="amber" />
              <ActionButton disabled={submitting} label="拒绝" onClick={() => void handleReview('reject')} tone="rose" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-cyan-300" />
              <h3 className="text-base font-medium text-white">证据与估算</h3>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoCard label="冷却塔数量" value={`${item.coolingTowerCount}`} />
              <InfoCard label="技术置信度" value={`${(item.confidenceScore * 100).toFixed(1)}%`} icon={<Radar className="h-4 w-4 text-cyan-300" />} />
              <InfoCard label="证据条数" value={`${item.evidences.length}`} />
            </div>
            <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${confidenceLevel.tone}`}>
              <Radar className="h-3.5 w-3.5" />
              {confidenceLevel.label}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoCard label="估算冷量 RT" value={formatMetric(hvacMetrics.estimatedCapacityRt, 'RT')} icon={<Thermometer className="h-4 w-4 text-emerald-300" />} />
              <InfoCard label="估算功率" value={formatMetric(hvacMetrics.estimatedPowerKw, 'kW')} />
              <InfoCard label="塔面积" value={formatMetric(hvacMetrics.totalAreaM2, 'm²')} />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-white">HVAC 估算快照</p>
              <pre className="mt-3 overflow-x-auto text-xs leading-6 text-slate-300">
                {JSON.stringify(item.hvacEstimateSnapshot, null, 2)}
              </pre>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-amber-300" />
              <h3 className="text-base font-medium text-white">Potential Duplicates</h3>
            </div>
            <p className="mt-2 text-sm text-slate-400">识别到疑似同企业 / 同站点候选时，在这里做显式去重。</p>

            {duplicatesLoading ? (
              <p className="mt-4 text-sm text-slate-500">正在加载重复匹配...</p>
            ) : duplicateRouteUnavailable ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                当前环境还没有接入 `GET /v1/candidates/:candidateId/duplicates` 与 `POST /v1/candidates/:candidateId/dedupe`。
              </div>
            ) : duplicateError ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {duplicateError}
              </div>
            ) : duplicates.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                当前没有返回潜在重复项。
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  {duplicates.map((duplicate) => (
                    <button
                      key={duplicate.id}
                      type="button"
                      onClick={() => setSelectedDuplicateId(duplicate.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedDuplicateId === duplicate.id
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-white">{duplicate.matchedEnterpriseName || duplicate.candidateCode}</span>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{duplicate.candidateCode}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{duplicate.matchedAddress || '未绑定地址'}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        {typeof duplicate.relationScore === 'number' ? <span>匹配分 {(duplicate.relationScore * 100).toFixed(0)}%</span> : null}
                        {duplicate.relationType ? <span>关系 {duplicate.relationType}</span> : null}
                        {typeof duplicate.coolingTowerCount === 'number' ? <span>冷却塔 {duplicate.coolingTowerCount} 处</span> : null}
                        {typeof duplicate.confidenceScore === 'number' ? <span>置信度 {(duplicate.confidenceScore * 100).toFixed(1)}%</span> : null}
                      </div>
                      {duplicate.reason ? (
                        <p className="mt-2 text-xs text-amber-200/80">{duplicate.reason}</p>
                      ) : null}
                    </button>
                  ))}
                </div>

                <textarea
                  value={duplicateNote}
                  onChange={(event) => setDuplicateNote(event.target.value)}
                  placeholder="记录去重原因或补充说明"
                  className="mt-4 min-h-[96px] w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500/40"
                />
                <button
                  onClick={() => void handleMarkDuplicate()}
                  disabled={submitting || !selectedDuplicateId}
                  className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  标记为所选 Candidate 的重复项
                </button>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-indigo-300" />
              <h3 className="text-base font-medium text-white">创建 Lead</h3>
            </div>
            <p className="mt-2 text-sm text-slate-400">只有 `approved` 状态的 Candidate 才允许转为正式 Lead。</p>
            <input
              value={leadName}
              onChange={(event) => setLeadName(event.target.value)}
              placeholder="Lead 名称"
              className="mt-4 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/40"
            />
            <button
              onClick={() => void handleCreateLead()}
              disabled={submitting || item.status !== 'approved'}
              className="mt-4 w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {item.status === 'approved' ? '从 Candidate 创建 Lead' : '当前状态不可创建 Lead'}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-base font-medium text-white">Evidence 列表</h3>
            <div className="mt-4 space-y-3">
              {item.evidences.length === 0 ? (
                <p className="text-sm text-slate-500">没有找到候选证据。</p>
              ) : (
                <>
                  {evidenceKinds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {evidenceKinds.map(([kind, count]) => (
                        <span key={kind} className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-[11px] text-slate-300">
                          {kind} x {count}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {item.evidences.map((evidence) => (
                    <div key={evidence.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-white">{evidence.kind}</span>
                        <span className="text-xs text-slate-400">排序 {evidence.sortOrder}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                        <span>截图 ID: {evidence.screenshotId ?? '-'}</span>
                        <span>检测 ID: {evidence.detectionResultId ?? '-'}</span>
                      </div>
                      <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-6 text-slate-400">
                        {JSON.stringify(evidence.metadata, null, 2)}
                      </pre>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
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

function ActionButton(
  { disabled, label, onClick, tone }: { disabled: boolean; label: string; onClick: () => void; tone: 'emerald' | 'amber' | 'rose' },
) {
  const tones = {
    emerald: 'bg-emerald-600 hover:bg-emerald-500',
    amber: 'bg-amber-600 hover:bg-amber-500',
    rose: 'bg-rose-600 hover:bg-rose-500',
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${tones[tone]}`}
    >
      {label}
    </button>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function formatMetric(value: number | null, unit: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
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
