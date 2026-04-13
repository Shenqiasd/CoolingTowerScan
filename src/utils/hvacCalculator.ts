const COOLING_LOAD_MAP: Record<string, { min: number; max: number; typical: number }> = {
  '办公楼': { min: 100, max: 150, typical: 120 },
  '办公': { min: 100, max: 150, typical: 120 },
  '商场': { min: 150, max: 250, typical: 200 },
  '商业': { min: 150, max: 250, typical: 200 },
  '零售': { min: 130, max: 200, typical: 160 },
  '批发': { min: 100, max: 160, typical: 130 },
  '酒店': { min: 120, max: 180, typical: 150 },
  '宾馆': { min: 120, max: 180, typical: 150 },
  '住宿': { min: 120, max: 180, typical: 150 },
  '医院': { min: 150, max: 250, typical: 200 },
  '医疗': { min: 150, max: 250, typical: 200 },
  '卫生': { min: 130, max: 200, typical: 160 },
  '学校': { min: 80, max: 120, typical: 100 },
  '教育': { min: 80, max: 120, typical: 100 },
  '工厂': { min: 80, max: 150, typical: 110 },
  '制造': { min: 80, max: 150, typical: 110 },
  '工业': { min: 80, max: 150, typical: 110 },
  '餐饮': { min: 200, max: 350, typical: 250 },
  '数据中心': { min: 300, max: 600, typical: 450 },
  '信息': { min: 150, max: 300, typical: 220 },
  '软件': { min: 120, max: 200, typical: 150 },
  '通信': { min: 200, max: 400, typical: 300 },
  '体育': { min: 120, max: 180, typical: 150 },
  '文化': { min: 100, max: 150, typical: 120 },
  '交通': { min: 100, max: 160, typical: 130 },
  '物流': { min: 60, max: 100, typical: 80 },
  '仓储': { min: 40, max: 80, typical: 60 },
  '住宅': { min: 60, max: 100, typical: 80 },
  '房地产': { min: 100, max: 160, typical: 130 },
  '租赁': { min: 100, max: 150, typical: 120 },
  '金融': { min: 120, max: 180, typical: 150 },
  '科学': { min: 100, max: 160, typical: 130 },
  '科技': { min: 100, max: 160, typical: 130 },
  '电力': { min: 80, max: 140, typical: 110 },
  '水利': { min: 60, max: 100, typical: 80 },
};

const DEFAULT_COOLING_LOAD = { min: 100, max: 180, typical: 130 };
const RT_TO_KW = 3.517;
const TYPICAL_COP = 5.8;
const TYPICAL_SINGLE_UNIT_RT = 350;
const DEFAULT_HEAT_REJECTION_FACTOR = 1.25;
const COUNT_BASELINE_RT = {
  conservative: 250,
  typical: 350,
  aggressive: 500,
} as const;
const SIZE_BASELINE_RT_PER_M2 = {
  conservative: 14,
  typical: 18,
  aggressive: 24,
} as const;
const COUNT_ONLY_WEIGHT = 1;
const SIZE_WEIGHT = 0.65;
const COUNT_WEIGHT_WITH_SIZE = 0.35;

function matchIndustry(category: string): { min: number; max: number; typical: number } {
  for (const [key, value] of Object.entries(COOLING_LOAD_MAP)) {
    if (category.includes(key)) return value;
  }
  return DEFAULT_COOLING_LOAD;
}

export interface HvacScenario {
  estimated_building_area: number;
  unit_cooling_load: number;
  peak_cooling_load: number;
  total_cooling_capacity_rt: number;
  estimated_heat_rejection_kw: number;
  chiller_count: number;
  single_unit_capacity_rt: number;
  single_unit_rated_power_kw: number;
  cooling_station_rated_power_kw: number;
  cooling_station_rated_power_mw: number;
}

export interface HvacEstimateDetails {
  method: 'none' | 'count-only' | 'count-and-size' | 'manual-count';
  tower_count: number;
  detected_tower_total_area_m2: number;
  detected_tower_avg_area_m2: number;
  detected_tower_max_area_m2: number;
  assumptions: {
    heat_rejection_factor: number;
    count_based_rt_per_tower: {
      conservative: number;
      typical: number;
      aggressive: number;
    };
    tower_rt_per_m2: {
      conservative: number;
      typical: number;
      aggressive: number;
    };
  };
  industry_load_profile: { min: number; max: number; typical: number };
  scenarios: {
    conservative: HvacScenario;
    typical: HvacScenario;
    aggressive: HvacScenario;
  };
}

export interface HvacResult extends HvacScenario {
  detected_tower_total_area_m2: number;
  detected_tower_avg_area_m2: number;
  detected_tower_max_area_m2: number;
  hvac_estimate_details: HvacEstimateDetails;
}

export interface CalculateHvacOptions {
  detectedTowerTotalAreaM2?: number;
  detectedTowerAvgAreaM2?: number;
  detectedTowerMaxAreaM2?: number;
  method?: 'count-only' | 'count-and-size' | 'manual-count';
}

function zeroScenario(): HvacScenario {
  return {
    estimated_building_area: 0,
    unit_cooling_load: 0,
    peak_cooling_load: 0,
    total_cooling_capacity_rt: 0,
    estimated_heat_rejection_kw: 0,
    chiller_count: 0,
    single_unit_capacity_rt: 0,
    single_unit_rated_power_kw: 0,
    cooling_station_rated_power_kw: 0,
    cooling_station_rated_power_mw: 0,
  };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildScenario(totalCoolingCapacityRT: number, unitCoolingLoad: number): HvacScenario {
  if (totalCoolingCapacityRT <= 0 || unitCoolingLoad <= 0) {
    return zeroScenario();
  }

  const peakCoolingLoad = totalCoolingCapacityRT * RT_TO_KW;
  const estimatedHeatRejectionKw = peakCoolingLoad * DEFAULT_HEAT_REJECTION_FACTOR;
  const estimatedBuildingArea = (peakCoolingLoad * 1000) / unitCoolingLoad;
  const chillerCount = Math.max(1, Math.ceil(totalCoolingCapacityRT / TYPICAL_SINGLE_UNIT_RT));
  const singleUnitCapacityRT = totalCoolingCapacityRT / chillerCount;
  const singleUnitRatedPowerKW = (singleUnitCapacityRT * RT_TO_KW) / TYPICAL_COP;
  const coolingStationRatedPowerKW = singleUnitRatedPowerKW * chillerCount;

  return {
    estimated_building_area: Math.round(estimatedBuildingArea),
    unit_cooling_load: Math.round(unitCoolingLoad),
    peak_cooling_load: round1(peakCoolingLoad),
    total_cooling_capacity_rt: round1(totalCoolingCapacityRT),
    estimated_heat_rejection_kw: round1(estimatedHeatRejectionKw),
    chiller_count: chillerCount,
    single_unit_capacity_rt: Math.round(singleUnitCapacityRT),
    single_unit_rated_power_kw: Math.round(singleUnitRatedPowerKW),
    cooling_station_rated_power_kw: Math.round(coolingStationRatedPowerKW),
    cooling_station_rated_power_mw: round2(coolingStationRatedPowerKW / 1000),
  };
}

function blendedCapacityRt(
  coolingTowerCount: number,
  detectedTowerTotalAreaM2: number,
  countBaselineRt: number,
  sizeBaselineRtPerM2: number,
): number {
  const countCapacity = coolingTowerCount * countBaselineRt;
  if (detectedTowerTotalAreaM2 <= 0) {
    return countCapacity * COUNT_ONLY_WEIGHT;
  }

  const sizeCapacity = detectedTowerTotalAreaM2 * sizeBaselineRtPerM2;
  return (countCapacity * COUNT_WEIGHT_WITH_SIZE) + (sizeCapacity * SIZE_WEIGHT);
}

export function calculateHVAC(
  coolingTowerCount: number,
  industryCategory: string,
  options: CalculateHvacOptions = {},
): HvacResult {
  const detectedTowerTotalAreaM2 = Math.max(0, options.detectedTowerTotalAreaM2 ?? 0);
  const detectedTowerAvgAreaM2 = Math.max(0, options.detectedTowerAvgAreaM2 ?? 0);
  const detectedTowerMaxAreaM2 = Math.max(0, options.detectedTowerMaxAreaM2 ?? 0);
  const hasMeasuredTowerArea = detectedTowerTotalAreaM2 > 0;
  const method = options.method ?? (hasMeasuredTowerArea ? 'count-and-size' : 'count-only');

  if (coolingTowerCount <= 0) {
    const zero = zeroScenario();
    return {
      ...zero,
      detected_tower_total_area_m2: 0,
      detected_tower_avg_area_m2: 0,
      detected_tower_max_area_m2: 0,
      hvac_estimate_details: {
        method: 'none',
        tower_count: 0,
        detected_tower_total_area_m2: 0,
        detected_tower_avg_area_m2: 0,
        detected_tower_max_area_m2: 0,
        assumptions: {
          heat_rejection_factor: DEFAULT_HEAT_REJECTION_FACTOR,
          count_based_rt_per_tower: { ...COUNT_BASELINE_RT },
          tower_rt_per_m2: { ...SIZE_BASELINE_RT_PER_M2 },
        },
        industry_load_profile: matchIndustry(industryCategory),
        scenarios: {
          conservative: zero,
          typical: zero,
          aggressive: zero,
        },
      },
    };
  }

  const load = matchIndustry(industryCategory);
  const conservative = buildScenario(
    blendedCapacityRt(
      coolingTowerCount,
      detectedTowerTotalAreaM2,
      COUNT_BASELINE_RT.conservative,
      SIZE_BASELINE_RT_PER_M2.conservative,
    ),
    load.min,
  );
  const typical = buildScenario(
    blendedCapacityRt(
      coolingTowerCount,
      detectedTowerTotalAreaM2,
      COUNT_BASELINE_RT.typical,
      SIZE_BASELINE_RT_PER_M2.typical,
    ),
    load.typical,
  );
  const aggressive = buildScenario(
    blendedCapacityRt(
      coolingTowerCount,
      detectedTowerTotalAreaM2,
      COUNT_BASELINE_RT.aggressive,
      SIZE_BASELINE_RT_PER_M2.aggressive,
    ),
    load.max,
  );

  return {
    ...typical,
    detected_tower_total_area_m2: round2(detectedTowerTotalAreaM2),
    detected_tower_avg_area_m2: round2(detectedTowerAvgAreaM2),
    detected_tower_max_area_m2: round2(detectedTowerMaxAreaM2),
    hvac_estimate_details: {
      method,
      tower_count: coolingTowerCount,
      detected_tower_total_area_m2: round2(detectedTowerTotalAreaM2),
      detected_tower_avg_area_m2: round2(detectedTowerAvgAreaM2),
      detected_tower_max_area_m2: round2(detectedTowerMaxAreaM2),
      assumptions: {
        heat_rejection_factor: DEFAULT_HEAT_REJECTION_FACTOR,
        count_based_rt_per_tower: { ...COUNT_BASELINE_RT },
        tower_rt_per_m2: { ...SIZE_BASELINE_RT_PER_M2 },
      },
      industry_load_profile: load,
      scenarios: {
        conservative,
        typical,
        aggressive,
      },
    },
  };
}

export function estimateHVACFromScore(
  compositeScore: number,
  industryCategory: string,
  probabilityLevel: string
): HvacResult {
  const load = matchIndustry(industryCategory);

  const baseArea = probabilityLevel === '高' ? 8000 : 4000;
  const scoreMultiplier = compositeScore > 0
    ? 1 + (compositeScore / 100) * 2
    : 0.8 + Math.random() * 0.4;
  const estimatedBuildingArea = Math.round(baseArea * scoreMultiplier);
  const totalCoolingCapacityRT = ((estimatedBuildingArea * load.typical) / 1000) / RT_TO_KW;
  const typical = buildScenario(totalCoolingCapacityRT, load.typical);

  return {
    ...typical,
    estimated_building_area: estimatedBuildingArea,
    detected_tower_total_area_m2: 0,
    detected_tower_avg_area_m2: 0,
    detected_tower_max_area_m2: 0,
    hvac_estimate_details: {
      method: 'count-only',
      tower_count: 0,
      detected_tower_total_area_m2: 0,
      detected_tower_avg_area_m2: 0,
      detected_tower_max_area_m2: 0,
      assumptions: {
        heat_rejection_factor: DEFAULT_HEAT_REJECTION_FACTOR,
        count_based_rt_per_tower: { ...COUNT_BASELINE_RT },
        tower_rt_per_m2: { ...SIZE_BASELINE_RT_PER_M2 },
      },
      industry_load_profile: load,
      scenarios: {
        conservative: buildScenario(totalCoolingCapacityRT * 0.8, load.min),
        typical: { ...typical, estimated_building_area: estimatedBuildingArea },
        aggressive: buildScenario(totalCoolingCapacityRT * 1.2, load.max),
      },
    },
  };
}
