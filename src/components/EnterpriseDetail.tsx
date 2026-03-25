import { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, ThermometerSun, Building2, Gauge, Cpu, PlugZap, Save, Radar, Target, Maximize2, MapPin, Tag, Star, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateHVAC } from '../utils/hvacCalculator';
import type { Enterprise, DetectionResult } from '../types/enterprise';
import ImageLightbox from './ImageLightbox';

interface EnterpriseDetailProps {
  enterprise: Enterprise;
  detectionResults: DetectionResult[];
  detectionsLoading: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Enterprise>) => Promise<boolean>;
}

const HVAC_FIELDS = [
  { key: 'cooling_tower_count', label: '冷却塔数量', unit: '台', icon: ThermometerSun },
  { key: 'estimated_building_area', label: '估算建筑面积', unit: 'm\u00B2', icon: Building2 },
  { key: 'unit_cooling_load', label: '单位冷负荷', unit: 'W/m\u00B2', icon: Gauge },
  { key: 'peak_cooling_load', label: '峰值冷负荷', unit: 'kW', icon: Gauge },
  { key: 'total_cooling_capacity_rt', label: '总制冷量', unit: 'RT', icon: ThermometerSun },
  { key: 'chiller_count', label: '主机台数', unit: '台', icon: Cpu },
  { key: 'single_unit_capacity_rt', label: '单机容量', unit: 'RT/台', icon: Cpu },
  { key: 'single_unit_rated_power_kw', label: '单机额定功率', unit: 'kW/台', icon: PlugZap },
  { key: 'cooling_station_rated_power_kw', label: '制冷站额定功率(kW)', unit: 'kW', icon: PlugZap },
  { key: 'cooling_station_rated_power_mw', label: '制冷站额定功率(MW)', unit: 'MW', icon: PlugZap },
] as const;

export default function EnterpriseDetail({ enterprise, detectionResults, detectionsLoading, onClose, onUpdate }: EnterpriseDetailProps) {
  const [uploading, setUploading] = useState(false);
  const [towerCount, setTowerCount] = useState(enterprise.cooling_tower_count);
  const [saving, setSaving] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const originalRef = useRef<HTMLInputElement>(null);
  const annotatedRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const lightboxImages = [
    enterprise.original_image_url ? { url: enterprise.original_image_url, label: '原始卫星图' } : null,
    enterprise.annotated_image_url ? { url: enterprise.annotated_image_url, label: '识别标注图' } : null,
  ].filter(Boolean) as { url: string; label: string }[];

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'original' | 'annotated') {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${enterprise.id}/${type}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('enterprise-images')
      .upload(path, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      setUploading(false);
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from('enterprise-images')
      .getPublicUrl(path);

    const urlField = type === 'original' ? 'original_image_url' : 'annotated_image_url';
    await onUpdate(enterprise.id, {
      [urlField]: publicUrl.publicUrl,
      image_uploaded_at: new Date().toISOString(),
    });

    setUploading(false);
  }

  async function handleSaveDetection() {
    setSaving(true);
    const hvac = calculateHVAC(towerCount, enterprise.industry_category);
    await onUpdate(enterprise.id, {
      cooling_tower_count: towerCount,
      has_cooling_tower: towerCount > 0,
      detection_status: 'detected',
      detection_confidence: 1,
      ...hvac,
    });
    setSaving(false);
  }

  const scoreColor = enterprise.composite_score >= 25
    ? 'text-emerald-400'
    : enterprise.composite_score >= 15
    ? 'text-cyan-400'
    : enterprise.composite_score > 0
    ? 'text-amber-400'
    : 'text-slate-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-semibold text-white leading-tight truncate">
              {enterprise.enterprise_name}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{enterprise.address}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
              enterprise.probability_level === '高'
                ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
            }`}>
              {enterprise.probability_level}概率
            </span>

            {enterprise.composite_score > 0 && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 ring-1 ring-slate-700/50 ${scoreColor}`}>
                <Star className="w-3 h-3" />
                {enterprise.composite_score}分
              </span>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 grid grid-cols-2 gap-6">

            <div className="space-y-5">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">基本信息</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Tag className="w-3 h-3 text-slate-500" />
                      <span className="text-xs text-slate-500">行业分类</span>
                    </div>
                    <p className="text-white font-medium">{enterprise.industry_category || '-'}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Star className="w-3 h-3 text-slate-500" />
                      <span className="text-xs text-slate-500">综合评分</span>
                    </div>
                    <p className={`font-semibold text-lg ${scoreColor}`}>
                      {enterprise.composite_score > 0 ? enterprise.composite_score : '-'}
                    </p>
                  </div>
                  {enterprise.longitude && (
                    <>
                      <div>
                        <span className="text-xs text-slate-500 block mb-0.5">经度</span>
                        <p className="text-white tabular-nums">{enterprise.longitude.toFixed(6)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block mb-0.5">纬度</span>
                        <p className="text-white tabular-nums">{enterprise.latitude?.toFixed(6)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">卫星图像</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500">原始卫星图</p>
                    {enterprise.original_image_url ? (
                      <div
                        className="relative group cursor-zoom-in w-full aspect-square rounded-lg overflow-hidden
                          border border-slate-700/40 hover:border-cyan-500/50 transition-all"
                        onClick={() => setLightboxIndex(0)}
                      >
                        <img
                          src={enterprise.original_image_url}
                          alt="原始图"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all
                          flex items-center justify-center">
                          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100
                            transition-opacity drop-shadow-lg" />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => originalRef.current?.click()}
                        disabled={uploading}
                        className="w-full aspect-square rounded-lg border border-dashed border-slate-600/50
                          flex flex-col items-center justify-center gap-2 hover:border-cyan-500/50
                          hover:bg-cyan-500/5 transition-all"
                      >
                        {uploading ? (
                          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                        ) : (
                          <>
                            <ImageIcon className="w-6 h-6 text-slate-500" />
                            <span className="text-xs text-slate-500">上传原始图</span>
                          </>
                        )}
                      </button>
                    )}
                    <input ref={originalRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'original')} className="hidden" />
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500">识别标注图</p>
                    {enterprise.annotated_image_url ? (
                      <div
                        className="relative group cursor-zoom-in w-full aspect-square rounded-lg overflow-hidden
                          border border-slate-700/40 hover:border-emerald-500/50 transition-all"
                        onClick={() => {
                          const idx = enterprise.original_image_url ? 1 : 0;
                          setLightboxIndex(idx);
                        }}
                      >
                        <img
                          src={enterprise.annotated_image_url}
                          alt="标注图"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all
                          flex items-center justify-center">
                          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100
                            transition-opacity drop-shadow-lg" />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => annotatedRef.current?.click()}
                        disabled={uploading}
                        className="w-full aspect-square rounded-lg border border-dashed border-slate-600/50
                          flex flex-col items-center justify-center gap-2 hover:border-emerald-500/50
                          hover:bg-emerald-500/5 transition-all"
                      >
                        {uploading ? (
                          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-slate-500" />
                            <span className="text-xs text-slate-500">上传标注图</span>
                          </>
                        )}
                      </button>
                    )}
                    <input ref={annotatedRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'annotated')} className="hidden" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">识别结果录入</p>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-400">冷却塔数量</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={towerCount}
                    onChange={(e) => setTowerCount(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-1.5 bg-slate-900/50 border border-slate-700/40 rounded-lg
                      text-sm text-white text-center focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    onClick={handleSaveDetection}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-cyan-600/20 text-cyan-400
                      border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 transition-all
                      disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    保存并计算
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {detectionResults.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radar className="w-4 h-4 text-teal-400" />
                      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">AI检测结果</p>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded-full">
                      {detectionResults.length} 个目标
                    </span>
                  </div>

                  {enterprise.detection_confidence > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500 text-xs">最高置信度</span>
                      <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            enterprise.detection_confidence >= 0.7 ? 'bg-emerald-500' :
                            enterprise.detection_confidence >= 0.4 ? 'bg-amber-500' : 'bg-slate-500'
                          }`}
                          style={{ width: `${enterprise.detection_confidence * 100}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${
                        enterprise.detection_confidence >= 0.7 ? 'text-emerald-400' :
                        enterprise.detection_confidence >= 0.4 ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {(enterprise.detection_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                    {detectionsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                      </div>
                    ) : (
                      detectionResults.map((det) => (
                        <div
                          key={det.id}
                          className="bg-slate-900/40 border border-slate-700/30 rounded-lg px-3 py-2
                            hover:border-slate-600/40 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Target className="w-3 h-3 text-teal-500" />
                              <span className="text-sm font-medium text-white">#{det.detection_id + 1}</span>
                              <span className="text-xs text-slate-500">{det.class_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    det.confidence >= 0.7 ? 'bg-emerald-500' :
                                    det.confidence >= 0.4 ? 'bg-amber-500' : 'bg-slate-500'
                                  }`}
                                  style={{ width: `${det.confidence * 100}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium tabular-nums ${
                                det.confidence >= 0.7 ? 'text-emerald-400' :
                                det.confidence >= 0.4 ? 'text-amber-400' : 'text-slate-400'
                              }`}>
                                {(det.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-slate-500">
                            <span>尺寸: {Math.round(det.bbox_width)}x{Math.round(det.bbox_height)}</span>
                            <span>面积: {Math.round(det.bbox_area)}px</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {enterprise.has_cooling_tower && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">暖通估算指标</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {HVAC_FIELDS.map((field) => {
                      const value = enterprise[field.key as keyof Enterprise] as number;
                      return (
                        <div
                          key={field.key}
                          className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-3
                            hover:border-slate-600/40 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <field.icon className="w-3 h-3 text-slate-500" />
                            <span className="text-[11px] text-slate-400 leading-tight">{field.label}</span>
                          </div>
                          <p className="text-base font-semibold text-white">
                            {typeof value === 'number' && value > 0 ? value.toLocaleString() : '0'}
                            <span className="text-xs text-slate-500 ml-1 font-normal">{field.unit}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!enterprise.has_cooling_tower && detectionResults.length === 0 && (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-8 flex flex-col items-center justify-center text-center gap-3">
                  <Radar className="w-10 h-10 text-slate-600" />
                  <p className="text-sm text-slate-500">暂无检测数据</p>
                  <p className="text-xs text-slate-600">上传卫星图后进行AI识别，或手动输入冷却塔数量</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
