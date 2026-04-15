interface AreaBoundsOptions {
  widthMeters?: number;
  heightMeters?: number;
}

interface AreaBounds {
  topLeftLng: number;
  topLeftLat: number;
  bottomRightLng: number;
  bottomRightLat: number;
}

const METERS_PER_LAT_DEGREE = 111320;

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

export function buildAreaBoundsFromCenter(
  centerLng: number,
  centerLat: number,
  options: AreaBoundsOptions = {},
): AreaBounds {
  const widthMeters = options.widthMeters ?? 1600;
  const heightMeters = options.heightMeters ?? 1600;
  const latRadians = (centerLat * Math.PI) / 180;
  const lngMetersPerDegree = METERS_PER_LAT_DEGREE * Math.max(Math.cos(latRadians), 0.01);

  const lngDelta = widthMeters / 2 / lngMetersPerDegree;
  const latDelta = heightMeters / 2 / METERS_PER_LAT_DEGREE;

  return {
    topLeftLng: roundCoordinate(centerLng - lngDelta),
    topLeftLat: roundCoordinate(centerLat + latDelta),
    bottomRightLng: roundCoordinate(centerLng + lngDelta),
    bottomRightLat: roundCoordinate(centerLat - latDelta),
  };
}
