import type { ScanDetection } from '../types/pipeline.ts';
import { createEnterpriseHvacRepo, recomputeEnterpriseHvac } from './enterpriseHvac.ts';
import { calculateHVAC } from './hvacCalculator.ts';

export interface EnterpriseLookupResult {
  id: string;
  enterprise_name: string;
  address: string;
}

export interface EnterpriseDraft {
  account_number: string;
  enterprise_name: string;
  address: string;
  industry_category: string;
  composite_score: number;
  probability_level: string;
  match_dimension_details: Record<string, unknown>;
  longitude: number;
  latitude: number;
  geocoding_status: string;
  has_cooling_tower: boolean;
  cooling_tower_count: number;
  detection_confidence: number;
  detection_status: string;
  detected_tower_total_area_m2: number;
  detected_tower_avg_area_m2: number;
  detected_tower_max_area_m2: number;
  estimated_building_area: number;
  unit_cooling_load: number;
  peak_cooling_load: number;
  total_cooling_capacity_rt: number;
  chiller_count: number;
  single_unit_capacity_rt: number;
  single_unit_rated_power_kw: number;
  cooling_station_rated_power_kw: number;
  cooling_station_rated_power_mw: number;
  hvac_estimate_details: unknown;
  original_image_url: string | null;
  annotated_image_url: string;
  image_uploaded_at: string;
}

export interface AddressUploadEnterpriseRepo {
  findByAddress(address: string): Promise<EnterpriseLookupResult | null>;
  findByName(name: string): Promise<EnterpriseLookupResult | null>;
  createEnterprise(input: EnterpriseDraft): Promise<EnterpriseLookupResult>;
  linkScreenshotToEnterprise(screenshotId: string, enterpriseId: string): Promise<void>;
  linkDetectionsToEnterprise?(screenshotId: string, enterpriseId: string): Promise<void>;
  updateEnterpriseAnnotatedImage(enterpriseId: string, update: Partial<EnterpriseDraft>): Promise<void>;
  recomputeEnterpriseMetrics?(enterpriseId: string): Promise<void>;
}

export interface EnsureEnterpriseForAddressUploadOptions {
  detection: ScanDetection;
  annotatedUrl: string;
  now?: () => string;
  repo: AddressUploadEnterpriseRepo;
}

export interface AddressUploadEnterpriseResult {
  enterpriseId: string;
  created: boolean;
}

function resolveEnterpriseName(detection: ScanDetection): string {
  return detection.addressLabel?.trim() || detection.resolvedAddress?.trim() || detection.screenshotFilename;
}

function resolveEnterpriseAddress(detection: ScanDetection): string {
  return detection.resolvedAddress?.trim() || detection.addressLabel?.trim() || detection.screenshotFilename;
}

export function shouldAutoCreateEnterpriseForUpload(detection: ScanDetection): boolean {
  return Boolean(
    detection.source === 'address' &&
    detection.hasCoolingTower &&
    !detection.enterpriseId &&
    resolveEnterpriseAddress(detection),
  );
}

export function buildEnterpriseDraftFromDetection(
  detection: ScanDetection,
  annotatedUrl: string,
  uploadedAt: string,
): EnterpriseDraft {
  const hvac = calculateHVAC(detection.count, '');
  return {
    account_number: '',
    enterprise_name: resolveEnterpriseName(detection),
    address: resolveEnterpriseAddress(detection),
    industry_category: '',
    composite_score: 0,
    probability_level: '高',
    match_dimension_details: {
      source: 'address-upload',
      screenshot_id: detection.screenshotId,
    },
    longitude: detection.lng,
    latitude: detection.lat,
    geocoding_status: 'success',
    has_cooling_tower: true,
    cooling_tower_count: detection.count,
    detection_confidence: detection.confidence,
    detection_status: 'detected',
    detected_tower_total_area_m2: hvac.detected_tower_total_area_m2,
    detected_tower_avg_area_m2: hvac.detected_tower_avg_area_m2,
    detected_tower_max_area_m2: hvac.detected_tower_max_area_m2,
    estimated_building_area: hvac.estimated_building_area,
    unit_cooling_load: hvac.unit_cooling_load,
    peak_cooling_load: hvac.peak_cooling_load,
    total_cooling_capacity_rt: hvac.total_cooling_capacity_rt,
    chiller_count: hvac.chiller_count,
    single_unit_capacity_rt: hvac.single_unit_capacity_rt,
    single_unit_rated_power_kw: hvac.single_unit_rated_power_kw,
    cooling_station_rated_power_kw: hvac.cooling_station_rated_power_kw,
    cooling_station_rated_power_mw: hvac.cooling_station_rated_power_mw,
    hvac_estimate_details: hvac.hvac_estimate_details,
    original_image_url: detection.publicUrl || detection.imageUrl || null,
    annotated_image_url: annotatedUrl,
    image_uploaded_at: uploadedAt,
  };
}

export function createAddressUploadEnterpriseRepo(client: any): AddressUploadEnterpriseRepo {
  return {
    async findByAddress(address) {
      const { data, error } = await client
        .from('enterprises')
        .select('id, enterprise_name, address')
        .eq('address', address)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async findByName(name) {
      const { data, error } = await client
        .from('enterprises')
        .select('id, enterprise_name, address')
        .eq('enterprise_name', name)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async createEnterprise(input) {
      const { data, error } = await client
        .from('enterprises')
        .insert(input)
        .select('id, enterprise_name, address')
        .single();
      if (error || !data) throw error ?? new Error('failed to create enterprise');
      return data;
    },
    async linkScreenshotToEnterprise(screenshotId, enterpriseId) {
      const { error } = await client
        .from('scan_screenshots')
        .update({ enterprise_id: enterpriseId })
        .eq('id', screenshotId);
      if (error) throw error;
    },
    async linkDetectionsToEnterprise(screenshotId, enterpriseId) {
      const { error } = await client
        .from('detection_results')
        .update({ enterprise_id: enterpriseId })
        .eq('screenshot_id', screenshotId);
      if (error) throw error;
    },
    async updateEnterpriseAnnotatedImage(enterpriseId, update) {
      const { error } = await client
        .from('enterprises')
        .update(update)
        .eq('id', enterpriseId);
      if (error) throw error;
    },
    async recomputeEnterpriseMetrics(enterpriseId) {
      await recomputeEnterpriseHvac(createEnterpriseHvacRepo(client), enterpriseId);
    },
  };
}

export async function ensureEnterpriseForAddressUpload({
  detection,
  annotatedUrl,
  now = () => new Date().toISOString(),
  repo,
}: EnsureEnterpriseForAddressUploadOptions): Promise<AddressUploadEnterpriseResult | null> {
  if (!shouldAutoCreateEnterpriseForUpload(detection) || !detection.screenshotId) {
    return null;
  }

  const address = resolveEnterpriseAddress(detection);
  const name = resolveEnterpriseName(detection);

  let enterprise = await repo.findByAddress(address);
  if (!enterprise && name && name !== address) {
    enterprise = await repo.findByName(name);
  }

  let created = false;
  if (!enterprise) {
    enterprise = await repo.createEnterprise(buildEnterpriseDraftFromDetection(detection, annotatedUrl, now()));
    created = true;
  }

  await repo.linkScreenshotToEnterprise(detection.screenshotId, enterprise.id);
  await repo.linkDetectionsToEnterprise?.(detection.screenshotId, enterprise.id);
  await repo.updateEnterpriseAnnotatedImage(enterprise.id, {
    original_image_url: detection.publicUrl || detection.imageUrl || null,
    annotated_image_url: annotatedUrl,
    image_uploaded_at: now(),
    has_cooling_tower: true,
    cooling_tower_count: detection.count,
    detection_confidence: detection.confidence,
    detection_status: 'detected',
    longitude: detection.lng,
    latitude: detection.lat,
    geocoding_status: 'success',
  });
  await repo.recomputeEnterpriseMetrics?.(enterprise.id);

  return {
    enterpriseId: enterprise.id,
    created,
  };
}
