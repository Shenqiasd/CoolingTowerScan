import gcoord from 'gcoord';
import { supabase } from '../lib/supabase';
import { createEnterpriseHvacRepo, recomputeEnterpriseHvac } from './enterpriseHvac.ts';
import { updateScanCandidatesByScreenshot } from './scanCandidateRepo.ts';

const AMAP_KEY = 'a7330f3c7b474880113a2f76cd02d9b4';

export interface MatchResult {
  id: string;
  enterprise_name: string;
  address: string;
  distance_m: number;
  method: 'spatial' | 'text';
}

/** Step 1: PostGIS spatial match within radius_m meters */
async function spatialMatch(lng: number, lat: number, radiusM = 200): Promise<MatchResult[]> {
  const { data, error } = await supabase.rpc('match_enterprise_spatial', {
    p_lng: lng,
    p_lat: lat,
    p_radius_m: radiusM,
  });
  if (error || !data?.length) return [];
  return (data as any[]).map(r => ({ ...r, method: 'spatial' as const }));
}

/** Step 2: AMAP reverse geocoding (WGS84 → GCJ02 → POI name) */
async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  const [gcjLng, gcjLat] = gcoord.transform([lng, lat], gcoord.WGS84, gcoord.GCJ02);
  const url = `https://restapi.amap.com/v3/geocode/regeo?location=${gcjLng},${gcjLat}&key=${AMAP_KEY}&extensions=all&output=json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '1') return null;
    const pois = data.regeocode?.pois;
    if (pois?.length) return pois[0].name as string;
    return data.regeocode?.formatted_address ?? null;
  } catch {
    return null;
  }
}

/** Step 3: Fuzzy text match against enterprises.enterprise_name */
async function textMatch(keyword: string): Promise<MatchResult[]> {
  const { data, error } = await supabase
    .from('enterprises')
    .select('id, enterprise_name, address')
    .ilike('enterprise_name', `%${keyword}%`)
    .limit(5);
  if (error || !data?.length) return [];
  return data.map(r => ({ ...r, distance_m: -1, method: 'text' as const }));
}

/** Three-step enterprise matching for area screenshots */
export async function matchEnterprise(lng: number, lat: number): Promise<MatchResult[]> {
  // Step 1: spatial
  const spatial = await spatialMatch(lng, lat);
  if (spatial.length) return spatial;

  // Step 2: reverse geocode → Step 3: text match
  const poiName = await reverseGeocode(lng, lat);
  if (!poiName) return [];
  return textMatch(poiName);
}

/** Confirm enterprise link: update scan_screenshots + enterprises */
export async function confirmEnterpriseMatch(
  screenshotId: string,
  enterpriseId: string,
  detectionData: { hasCoolingTower: boolean; count: number; confidence: number; annotatedUrl?: string | null }
): Promise<void> {
  const { data: enterprise } = await supabase
    .from('enterprises')
    .select('enterprise_name, address')
    .eq('id', enterpriseId)
    .maybeSingle();

  await supabase
    .from('scan_screenshots')
    .update({ enterprise_id: enterpriseId })
    .eq('id', screenshotId);

  await supabase
    .from('detection_results')
    .update({ enterprise_id: enterpriseId })
    .eq('screenshot_id', screenshotId);

  await updateScanCandidatesByScreenshot(supabase, screenshotId, {
    enterprise_id: enterpriseId,
    status: 'approved',
    matched_enterprise_name: enterprise?.enterprise_name ?? '',
    matched_address: enterprise?.address ?? '',
    reviewed_at: new Date().toISOString(),
    rejection_reason: '',
  });

  const enterpriseUpdate: Record<string, unknown> = {
    match_dimension_details: {
      source: 'area',
      screenshot_id: screenshotId,
    },
  };

  if (detectionData.annotatedUrl) {
    enterpriseUpdate.annotated_image_url = detectionData.annotatedUrl;
  }

  await supabase
    .from('enterprises')
    .update(enterpriseUpdate)
    .eq('id', enterpriseId);

  await recomputeEnterpriseHvac(createEnterpriseHvacRepo(supabase), enterpriseId);
}
