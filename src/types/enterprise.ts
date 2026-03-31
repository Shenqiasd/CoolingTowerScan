export interface Enterprise {
  id: string;
  account_number: string;
  enterprise_name: string;
  address: string;
  industry_category: string;
  major_category: string;
  sub_category: string;
  composite_score: number;
  probability_level: string;
  match_dimension_details: Record<string, unknown>;
  longitude: number | null;
  latitude: number | null;
  geocoding_status: string;
  has_cooling_tower: boolean;
  cooling_tower_count: number;
  detection_confidence: number;
  detection_status: string;
  estimated_building_area: number;
  unit_cooling_load: number;
  peak_cooling_load: number;
  total_cooling_capacity_rt: number;
  chiller_count: number;
  single_unit_capacity_rt: number;
  single_unit_rated_power_kw: number;
  cooling_station_rated_power_kw: number;
  cooling_station_rated_power_mw: number;
  original_image_url: string | null;
  annotated_image_url: string | null;
  image_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DetectionResult {
  id: string;
  enterprise_id: string | null;
  account_number: string;
  image_path: string;
  detection_id: number;
  confidence: number;
  class_name: string;
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
  center_x: number;
  center_y: number;
  bbox_width: number;
  bbox_height: number;
  bbox_area: number;
  created_at: string;
}

export interface EnterpriseFilters {
  probabilityLevel: string;
  detectionStatus: string;
  industryCategory: string;
  majorCategory: string;
  subCategory: string;
  searchText: string;
  hasCoolingTower: string;
}

export interface StatsData {
  totalEnterprises: number;
  confirmedCoolingTower: number;
  highProbabilityCount: number;
  mediumProbabilityCount: number;
  totalCoolingCapacityMW: number;
}
