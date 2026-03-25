import { useState, useRef } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, ThermometerSun, Building2, Gauge, Cpu, PlugZap, Save, Radar, Target, Maximize2 } from 'lucide-react';
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
  { key: 'cooling_station_rated_power_kw', label: '制冷站额定功率', unit: 'kW', icon: PlugZap },
  { key: 'cooling_station_rated_power_mw', label: '制冷站额定功率', unit: 'MW', icon: PlugZap },
] as const;

export default function EnterpriseDetail({ enterprise, detectionResults, detectionsLoading, onClose, onUpdate }: EnterpriseDetailProps) {
  const [uploading, setUploading] = useState(false);
  const [towerCount, setTowerCount] = useState(enterprise.cooling_tower_count);
  const [saving, setSaving] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const originalRef = useRef<HTMLInputElement>(null);
  const annotatedRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <h3 className="text-sm font-semibold text-white truncate flex-1">
          {enterprise.enterprise_name}
        </h3>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md hover:bg-slate-700/50 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <span className="text-slate-500">行业分类</span>
            <p className="text-white">{enterprise.industry_category}</p>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500">用电地址</span>
            <p className="text-white">{enterprise.address}</p>
          </div>
          <div>
            <span className="text-slate-500">综合评分</span>
            <p className="text-cyan-400 font-medium">{enterprise.composite_score}</p>
          </div>
          <div>
            <span className="text-slate-500">概率等级</span>
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
              enterprise.probability_level === '高'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {enterprise.probability_level}概率
            </span>
          </div>
          {enterprise.longitude && (
            <>
              <div>
                <span className="text-slate-500">经度</span>
                <p className="text-white">{enterprise.longitude.toFixed(6)}</p>
              </div>
              <div>
                <span className="text-slate-500">纬度</span>
                <p className="text-white">{enterprise.latitude?.toFixed(6)}</p>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-300">图片对比</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500">原始卫星图</p>
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
                    <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100
                      transition-opacity drop-shadow-lg" />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => originalRef.current?.click()}
                  disabled={uploading}
                  className="w-full aspect-square rounded-lg border border-dashed border-slate-600/50
                    flex flex-col items-center justify-center gap-1 hover:border-cyan-500/50
                    hover:bg-cyan-500/5 transition-all"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-slate-500" />
                      <span className="text-[10px] text-slate-500">上传原始图</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={originalRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'original')}
                className="hidden"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500">识别标注图</p>
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
                    <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100
                      transition-opacity drop-shadow-lg" />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => annotatedRef.current?.click()}
                  disabled={uploading}
                  className="w-full aspect-square rounded-lg border border-dashed border-slate-600/50
                    flex flex-col items-center justify-center gap-1 hover:border-emerald-500/50
                    hover:bg-emerald-500/5 transition-all"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-slate-500" />
                      <span className="text-[10px] text-slate-500">上传标注图</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={annotatedRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'annotated')}
                className="hidden"
              />
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

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-300">识别结果</p>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">冷却塔数量:</label>
            <input
              type="number"
              min={0}
              max={50}
              value={towerCount}
              onChange={(e) => setTowerCount(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 bg-slate-900/50 border border-slate-700/40 rounded-md
                text-sm text-white text-center focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={handleSaveDetection}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-600/20 text-cyan-400
                border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 transition-all
                disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              保存并计算
            </button>
          </div>
        </div>

        {detectionResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Radar className="w-3.5 h-3.5 text-teal-400" />
              <p className="text-xs font-medium text-slate-300">AI检测结果</p>
              <span className="text-[10px] text-slate-500">
                ({detectionResults.length} 个目标)
              </span>
            </div>

            {enterprise.detection_confidence > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">最高置信度:</span>
                <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      enterprise.detection_confidence >= 0.7 ? 'bg-emerald-500' :
                      enterprise.detection_confidence >= 0.4 ? 'bg-amber-500' : 'bg-slate-500'
                    }`}
                    style={{ width: `${enterprise.detection_confidence * 100}%` }}
                  />
                </div>
                <span className={`font-medium tabular-nums ${
                  enterprise.detection_confidence >= 0.7 ? 'text-emerald-400' :
                  enterprise.detection_confidence >= 0.4 ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {(enterprise.detection_confidence * 100).toFixed(0)}%
                </span>
              </div>
            )}

            <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
              {detectionsLoading ? (
                <div className="flex items-center justify-center py-3">
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
                        <span className="text-[11px] font-medium text-white">
                          #{det.detection_id + 1}
                        </span>
                        <span className="text-[10px] text-slate-500">{det.class_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              det.confidence >= 0.7 ? 'bg-emerald-500' :
                              det.confidence >= 0.4 ? 'bg-amber-500' : 'bg-slate-500'
                            }`}
                            style={{ width: `${det.confidence * 100}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium tabular-nums ${
                          det.confidence >= 0.7 ? 'text-emerald-400' :
                          det.confidence >= 0.4 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {(det.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
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
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-300">暖通估算指标</p>
            <div className="grid grid-cols-2 gap-2">
              {HVAC_FIELDS.map((field) => {
                const value = enterprise[field.key as keyof Enterprise] as number;
                return (
                  <div
                    key={field.key}
                    className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-2.5
                      hover:border-slate-600/40 transition-all"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <field.icon className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-400">{field.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {typeof value === 'number' ? value.toLocaleString() : '0'}
                      <span className="text-[10px] text-slate-500 ml-1">{field.unit}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
