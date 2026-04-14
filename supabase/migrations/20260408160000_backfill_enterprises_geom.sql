/*
  # Backfill enterprises.geom for drifted production schemas

  Some production environments have `enterprises.longitude/latitude` but are
  missing the PostGIS `geom` column created in the original bootstrap
  migration. Later spatial matching migrations depend on `geom`, so this
  migration restores the column and backfills it from existing coordinates.
*/

ALTER TABLE enterprises
  ADD COLUMN IF NOT EXISTS geom public.geometry(Point, 4326);

UPDATE enterprises
SET geom = ST_SetSRID(
  ST_MakePoint(longitude::double precision, latitude::double precision),
  4326
)
WHERE geom IS NULL
  AND longitude IS NOT NULL
  AND latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enterprises_geom
  ON enterprises USING GIST (geom);
