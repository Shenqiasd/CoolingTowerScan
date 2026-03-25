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

function matchIndustry(category: string): { min: number; max: number; typical: number } {
  for (const [key, value] of Object.entries(COOLING_LOAD_MAP)) {
    if (category.includes(key)) return value;
  }
  return DEFAULT_COOLING_LOAD;
}

export interface HvacResult {
  estimated_building_area: number;
  unit_cooling_load: number;
  peak_cooling_load: number;
  total_cooling_capacity_rt: number;
  chiller_count: number;
  single_unit_capacity_rt: number;
  single_unit_rated_power_kw: number;
  cooling_station_rated_power_kw: number;
  cooling_station_rated_power_mw: number;
}

export function calculateHVAC(
  coolingTowerCount: number,
  industryCategory: string
): HvacResult {
  if (coolingTowerCount <= 0) {
    return {
      estimated_building_area: 0,
      unit_cooling_load: 0,
      peak_cooling_load: 0,
      total_cooling_capacity_rt: 0,
      chiller_count: 0,
      single_unit_capacity_rt: 0,
      single_unit_rated_power_kw: 0,
      cooling_station_rated_power_kw: 0,
      cooling_station_rated_power_mw: 0,
    };
  }

  const load = matchIndustry(industryCategory);
  const estimatedBuildingArea = coolingTowerCount * 5000;
  const unitCoolingLoad = load.typical;
  const peakCoolingLoad = (estimatedBuildingArea * unitCoolingLoad) / 1000;
  const totalCoolingCapacityRT = peakCoolingLoad / RT_TO_KW;
  const chillerCount = Math.max(1, Math.ceil(totalCoolingCapacityRT / TYPICAL_SINGLE_UNIT_RT));
  const singleUnitCapacityRT = Math.round(totalCoolingCapacityRT / chillerCount);
  const singleUnitRatedPowerKW = Math.round((singleUnitCapacityRT * RT_TO_KW) / TYPICAL_COP);
  const coolingStationRatedPowerKW = singleUnitRatedPowerKW * chillerCount;
  const coolingStationRatedPowerMW = coolingStationRatedPowerKW / 1000;

  return {
    estimated_building_area: Math.round(estimatedBuildingArea),
    unit_cooling_load: Math.round(unitCoolingLoad),
    peak_cooling_load: Math.round(peakCoolingLoad * 10) / 10,
    total_cooling_capacity_rt: Math.round(totalCoolingCapacityRT * 10) / 10,
    chiller_count: chillerCount,
    single_unit_capacity_rt: Math.round(singleUnitCapacityRT),
    single_unit_rated_power_kw: Math.round(singleUnitRatedPowerKW),
    cooling_station_rated_power_kw: Math.round(coolingStationRatedPowerKW),
    cooling_station_rated_power_mw: Math.round(coolingStationRatedPowerMW * 100) / 100,
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

  const unitCoolingLoad = load.typical;
  const peakCoolingLoad = (estimatedBuildingArea * unitCoolingLoad) / 1000;
  const totalCoolingCapacityRT = peakCoolingLoad / RT_TO_KW;
  const chillerCount = Math.max(1, Math.ceil(totalCoolingCapacityRT / TYPICAL_SINGLE_UNIT_RT));
  const singleUnitCapacityRT = Math.round(totalCoolingCapacityRT / chillerCount);
  const singleUnitRatedPowerKW = Math.round((singleUnitCapacityRT * RT_TO_KW) / TYPICAL_COP);
  const coolingStationRatedPowerKW = singleUnitRatedPowerKW * chillerCount;
  const coolingStationRatedPowerMW = coolingStationRatedPowerKW / 1000;

  return {
    estimated_building_area: Math.round(estimatedBuildingArea),
    unit_cooling_load: Math.round(unitCoolingLoad),
    peak_cooling_load: Math.round(peakCoolingLoad * 10) / 10,
    total_cooling_capacity_rt: Math.round(totalCoolingCapacityRT * 10) / 10,
    chiller_count: chillerCount,
    single_unit_capacity_rt: Math.round(singleUnitCapacityRT),
    single_unit_rated_power_kw: Math.round(singleUnitRatedPowerKW),
    cooling_station_rated_power_kw: Math.round(coolingStationRatedPowerKW),
    cooling_station_rated_power_mw: Math.round(coolingStationRatedPowerMW * 100) / 100,
  };
}
