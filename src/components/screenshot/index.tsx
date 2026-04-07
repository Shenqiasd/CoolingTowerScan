import { useState } from 'react';
import { Camera, MapPin } from 'lucide-react';
import AreaMode from './AreaMode';
import AddressMode from './AddressMode';
import type { CaptureResult } from './CaptureEngine';

export type { CaptureResult };

// Re-export ScreenshotResult as alias for backward compat with App.tsx / pipeline.ts
export type ScreenshotResult = CaptureResult;

interface Props {
  onScreenshotsComplete?: (results: CaptureResult[]) => void;
}

const TOKEN_KEY = 'mapbox_token';

type ScreenshotMode = 'area' | 'address';

export default function MapScreenshot({ onScreenshotsComplete }: Props) {
  const [mode, setMode] = useState<ScreenshotMode>('area');
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(!localStorage.getItem(TOKEN_KEY));

  const handleTokenSave = () => {
    if (!tokenInput.trim()) return;
    localStorage.setItem(TOKEN_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
    setShowTokenInput(false);
  };

  const handleComplete = (results: CaptureResult[]) => {
    onScreenshotsComplete?.(results);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900">
        {/* Mode tabs */}
        <div className="flex bg-slate-800/60 border border-slate-700/40 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setMode('area')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'area'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            区域截图
          </button>
          <button
            onClick={() => setMode('address')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'address'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            地址搜索
          </button>
        </div>

        {/* Token config */}
        <div className="ml-auto flex items-center gap-2">
          {showTokenInput ? (
            <>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTokenSave()}
                placeholder="输入 Mapbox Token"
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white w-64 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleTokenSave}
                className="px-2 py-1 rounded text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                保存
              </button>
            </>
          ) : (
            <button
              onClick={() => { setTokenInput(token); setShowTokenInput(true); }}
              className="text-xs text-slate-500 hover:text-slate-300 underline"
            >
              {token ? '修改 Token' : '设置 Mapbox Token'}
            </button>
          )}
        </div>
      </div>

      {/* Mode content */}
      <div className="flex-1 min-h-0">
        {mode === 'area' ? (
          <AreaMode token={token} onComplete={handleComplete} />
        ) : (
          <AddressMode token={token} onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}
