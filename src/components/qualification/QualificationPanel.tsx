import { useState, useCallback } from 'react';
import {
  UserCheck, TrendingUp, Building2, MapPin,
  Thermometer, BarChart3, Loader2, AlertCircle,
  CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Enterprise } from '../../types/enterprise';
import type { QualificationOutput, QualificationScore } from '../../utils/agentApi';
import { runQualification } from '../../utils/agentApi';

interface Props {
  enterprise: Enterprise;
  projectId?: string;
  onScoreUpdate?: (score: number, priority: string) => void;
}

const SCORE_COLORS = {
  high: { bar: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
  medium: { bar: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
  low: { bar: 'bg-slate-500', text: 'text-slate-400', badge: 'bg-slate-500/20 text-slate-400' },
};

const DIMENSION_LABELS = {
  cooling_tower: { label: '冷却塔信号', max: 30, icon: Thermometer },
  cooling_capacity: { label: '制冷规模', max: 25, icon: BarChart3 },
  industry_match: { label: '行业匹配', max: 25, icon: Building2 },
  data_completeness: { label: '数据完整度', max: 20, icon: CheckCircle2 },
};

export default function QualificationPanel({ enterprise, projectId, onScoreUpdate }: Props) {
  const [result, setResult] = useState<QualificationOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const output = await runQualification(
        projectId || 'preview',
        enterprise as unknown as Record<string, unknown>,
      );
      setResult(output);
      onScoreUpdate?.(output.score.total_score, output.score.priority);
    } catch (e) {
      setError(e instanceof Error ? e.message : '评估失败');
    } finally {
      setLoading(false);
    }
  }, [enterprise, projectId, onScoreUpdate]);

  const score = result?.score;
  const colors = score ? SCORE_COLORS[score.priority] : null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">售前资质评估</span>
          {score && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors!.badge}`}>
              {score.total_score}/100
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Run button */}
          {!result && (
            <button
              onClick={handleRun}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  评估中...
                </>
              ) : (
                <>
                  <TrendingUp className="w-3.5 h-3.5" />
                  运行商机评估
                </>
              )}
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Score Result */}
          {score && (
            <>
              {/* Total Score */}
              <div className="text-center py-2">
                <div className={`text-3xl font-bold ${colors!.text}`}>
                  {score.total_score}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  商机评分 / 100
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="space-y-2">
                {(Object.entries(DIMENSION_LABELS) as [keyof typeof DIMENSION_LABELS, typeof DIMENSION_LABELS[keyof typeof DIMENSION_LABELS]][]).map(([key, dim]) => {
                  const value = score.breakdown[key];
                  const pct = (value / dim.max) * 100;
                  const Icon = dim.icon;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Icon className="w-3 h-3" />
                          {dim.label}
                        </div>
                        <span className="text-[11px] text-slate-300 font-medium">
                          {value}/{dim.max}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${colors!.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Profile Summary */}
              {result?.profile && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">客户画像</p>
                  <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {result.profile}
                  </pre>
                </div>
              )}

              {/* Re-run */}
              <button
                onClick={handleRun}
                disabled={loading}
                className="w-full text-center text-[11px] text-slate-500 hover:text-cyan-400 py-1 transition-colors"
              >
                {loading ? '重新评估中...' : '重新评估'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
