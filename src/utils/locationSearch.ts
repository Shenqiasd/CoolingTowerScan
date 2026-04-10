export interface SearchResult {
  name: string;
  address: string;
  location: string;
  coordinateSystem: 'gcj02' | 'wgs84';
}

export interface SearchProviderResult {
  provider: 'amap' | 'osm';
  results: SearchResult[];
  error: string | null;
}

interface SearchLocationsResult extends SearchProviderResult {
  fallbackReason: string | null;
}

function getAmapApiKey(): string {
  return import.meta.env.VITE_AMAP_API_KEY?.trim() || '';
}

export function normalizeAmapResults(payload: any): SearchProviderResult {
  if (payload?.status !== '1') {
    return {
      provider: 'amap',
      results: [],
      error: payload?.info && payload?.infocode
        ? `${payload.info} (${payload.infocode})`
        : payload?.info || 'UNKNOWN_AMAP_ERROR',
    };
  }

  const pois = Array.isArray(payload?.pois) ? payload.pois : [];
  return {
    provider: 'amap',
    results: pois
      .filter((poi: any) => poi?.location)
      .map((poi: any) => ({
        name: poi.name,
        address: poi.address || `${poi.pname || ''}${poi.cityname || ''}${poi.adname || ''}`,
        location: poi.location,
        coordinateSystem: 'gcj02' as const,
      })),
    error: null,
  };
}

export function normalizeOsmResults(payload: any): SearchProviderResult {
  const rows = Array.isArray(payload) ? payload : [];
  return {
    provider: 'osm',
    results: rows
      .filter((item) => item?.lon && item?.lat)
      .map((item) => ({
        name: item.name || item.display_name || `${item.lat},${item.lon}`,
        address: item.display_name || item.name || '',
        location: `${item.lon},${item.lat}`,
        coordinateSystem: 'wgs84' as const,
      })),
    error: null,
  };
}

async function searchWithAmap(keyword: string): Promise<SearchProviderResult> {
  const key = getAmapApiKey();
  if (!key) {
    return {
      provider: 'amap',
      results: [],
      error: 'MISSING_AMAP_API_KEY',
    };
  }

  const url = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keyword)}&key=${key}&output=json&offset=20&page=1&extensions=base`;
  const res = await fetch(url);
  const data = await res.json();
  return normalizeAmapResults(data);
}

async function searchWithOsm(keyword: string): Promise<SearchProviderResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&countrycodes=cn&q=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });
  const data = await res.json();
  return normalizeOsmResults(data);
}

export async function searchLocations(keyword: string): Promise<SearchLocationsResult> {
  const amap = await searchWithAmap(keyword);
  if (amap.results.length > 0) {
    return { ...amap, fallbackReason: null };
  }

  const osm = await searchWithOsm(keyword);
  if (osm.results.length > 0) {
    return {
      ...osm,
      fallbackReason: amap.error,
    };
  }

  return {
    provider: amap.provider,
    results: [],
    error: amap.error,
    fallbackReason: null,
  };
}
