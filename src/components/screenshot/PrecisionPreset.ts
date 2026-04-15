export type PrecisionPreset = 'coarse' | 'standard' | 'fine';

export interface PrecisionPresetConfig {
  zoomLevel: number;
  overlapPct: number;
  label: string;
  description: string;
}

const PRESETS: Record<PrecisionPreset, PrecisionPresetConfig> = {
  coarse: {
    zoomLevel: 16,
    overlapPct: 4,
    label: '粗扫',
    description: '覆盖优先，适合大范围排查',
  },
  standard: {
    zoomLevel: 18,
    overlapPct: 8,
    label: '标准',
    description: '速度与识别精度平衡',
  },
  fine: {
    zoomLevel: 19,
    overlapPct: 12,
    label: '精扫',
    description: '识别优先，适合重点区域复核',
  },
};

export function resolvePrecisionPreset(preset: PrecisionPreset): PrecisionPresetConfig {
  return PRESETS[preset];
}

export function listPrecisionPresets(): Array<{ value: PrecisionPreset } & PrecisionPresetConfig> {
  return Object.entries(PRESETS).map(([value, config]) => ({
    value: value as PrecisionPreset,
    ...config,
  }));
}
