import { useState } from 'react';
import { X, BarChart2, Layers, GitBranch, Download } from 'lucide-react';
import type { StatsData } from '../../types/enterprise';
import { useReportData } from '../../hooks/useReportData';
import ReportOverview from './ReportOverview';
import ReportIndustry from './ReportIndustry';
import ReportLogic from './ReportLogic';
import ReportExport from './ReportExport';

interface Props {
  stats: StatsData;
  onClose: () => void;
}

type TabId = 'overview' | 'industry' | 'logic' | 'export';

const TABS: Array<{ id: TabId; label: string; icon: typeof BarChart2 }> = [
  { id: 'overview', label: '数据总览', icon: BarChart2 },
  { id: 'industry', label: '行业洞察', icon: Layers },
  { id: 'logic', label: '识别逻辑', icon: GitBranch },
  { id: 'export', label: '数据导出', icon: Download },
];

export default function ReportModal({ stats, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { data: reportData, loading: reportLoading } = useReportData();

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-6xl mx-4 h-[90vh] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white leading-tight">
                浦东新区中央空调用户识别分析报告
              </h2>
              <p className="text-[10px] text-slate-500">基于卫星图像识别与行业属性分析 · v2</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex bg-slate-800/60 border border-slate-700/40 rounded-lg p-0.5 gap-0.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && <ReportOverview stats={stats} />}
          {activeTab === 'industry' && <ReportIndustry data={reportData} loading={reportLoading} />}
          {activeTab === 'logic' && <ReportLogic />}
          {activeTab === 'export' && <ReportExport stats={stats} />}
        </div>
      </div>
    </div>
  );
}
