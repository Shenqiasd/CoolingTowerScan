import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, Search, CheckCircle2, Building2, Loader2 } from 'lucide-react';
import type { ScanDetection } from '../../types/pipeline';
import { useEnterpriseMatch } from '../../hooks/useEnterpriseMatch';
import type { MatchResult } from '../../utils/enterpriseMatcher';
import { supabase } from '../../lib/supabase';

interface Props {
  detection: ScanDetection;
  onClose: () => void;
  onConfirm: (detection: ScanDetection, enterpriseId: string) => void;
}

export default function EnterpriseMatchModal({ detection, onClose, onConfirm }: Props) {
  const { match, loading } = useEnterpriseMatch();
  const [results, setResults] = useState<MatchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MatchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    match(detection.lng, detection.lat).then(setResults);
  }, [detection.lng, detection.lat, match]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('enterprises')
        .select('id, enterprise_name, address')
        .ilike('enterprise_name', `%${searchQuery.trim()}%`)
        .limit(10);
      if (error || !data) {
        setSearchResults([]);
        return;
      }
      setSearchResults(
        data.map(r => ({ ...r, distance_m: -1, method: 'text' as const }))
      );
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleConfirm = useCallback(async (enterpriseId: string) => {
    setConfirming(enterpriseId);
    try {
      onConfirm(detection, enterpriseId);
      onClose();
    } finally {
      setConfirming(null);
    }
  }, [detection, onConfirm, onClose]);

  const displayResults = searchResults.length > 0 ? searchResults : results;
  const hasResults = displayResults.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-xl bg-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <Building2 size={18} className="text-cyan-400" />
            企业匹配
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Screenshot info */}
        <div className="px-5 py-3 border-b border-slate-700 bg-slate-900/40">
          <p className="text-slate-300 text-sm font-mono truncate">{detection.screenshotFilename}</p>
          <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
            <MapPin size={12} />
            <span>{detection.lng.toFixed(6)}, {detection.lat.toFixed(6)}</span>
          </div>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">正在匹配企业…</span>
            </div>
          )}

          {!loading && !hasResults && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 text-sm gap-2">
              <Search size={24} className="text-slate-600" />
              <span>未找到匹配企业</span>
              <span className="text-xs text-slate-600">可在下方手动搜索企业名称</span>
            </div>
          )}

          {!loading && hasResults && displayResults.map(r => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-slate-700/50 px-4 py-3 hover:bg-slate-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium truncate">{r.enterprise_name}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      r.method === 'spatial'
                        ? 'bg-cyan-900/60 text-cyan-300'
                        : 'bg-purple-900/60 text-purple-300'
                    }`}
                  >
                    {r.method === 'spatial' ? '空间匹配' : '文本匹配'}
                  </span>
                </div>
                {r.address && (
                  <p className="text-slate-400 text-xs mt-0.5 truncate">{r.address}</p>
                )}
                {r.distance_m > 0 && (
                  <p className="text-slate-500 text-xs mt-0.5">距离 {Math.round(r.distance_m)}m</p>
                )}
              </div>
              <button
                onClick={() => handleConfirm(r.id)}
                disabled={confirming === r.id}
                className="flex items-center gap-1.5 shrink-0 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-3 py-1.5 text-white text-xs font-medium transition-colors"
              >
                {confirming === r.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <CheckCircle2 size={13} />
                }
                确认关联
              </button>
            </div>
          ))}
        </div>

        {/* Manual search */}
        <div className="px-5 py-4 border-t border-slate-700 space-y-2">
          <p className="text-slate-400 text-xs">手动搜索企业</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="输入企业名称…"
              className="flex-1 rounded-md bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-1.5 rounded-md bg-slate-600 hover:bg-slate-500 disabled:opacity-40 px-3 py-2 text-white text-sm transition-colors"
            >
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            跳过，不关联企业
          </button>
        </div>
      </div>
    </div>
  );
}
