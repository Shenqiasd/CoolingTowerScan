/*
  # Create Enterprises Table

  1. New Tables
    - `enterprises` - Main table storing enterprise records for central AC identification
      - `id` (uuid, primary key) - Unique identifier
      - `account_number` (text) - 户号, electricity account number
      - `enterprise_name` (text) - 户名, enterprise name
      - `address` (text) - 用电地址, electricity usage address
      - `industry_category` (text) - 行业分类, industry classification
      - `composite_score` (numeric) - 综合评分, composite screening score
      - `probability_level` (text) - 概率等级, probability level (高/中)
      - `match_dimension_details` (jsonb) - 匹配维度详情, structured matching criteria details
      - `longitude` (double precision) - Geocoded longitude
      - `latitude` (double precision) - Geocoded latitude
      - `geom` (geometry Point 4326) - PostGIS geometry point for spatial queries
      - `geocoding_status` (text) - Geocoding status: pending/success/failed
      - `has_cooling_tower` (boolean) - Whether cooling tower detected
      - `cooling_tower_count` (integer) - Number of cooling towers detected
      - `detection_confidence` (double precision) - Detection confidence score 0-1
      - `detection_status` (text) - Detection status: pending/detected/no_result
      - `estimated_building_area` (double precision) - Estimated building area in sqm
      - `unit_cooling_load` (double precision) - Unit cooling load in W/sqm
      - `peak_cooling_load` (double precision) - Peak cooling load in kW
      - `total_cooling_capacity_rt` (double precision) - Total cooling capacity in RT
      - `chiller_count` (integer) - Estimated chiller count
      - `single_unit_capacity_rt` (double precision) - Single chiller capacity in RT
      - `single_unit_rated_power_kw` (double precision) - Single chiller rated power in kW
      - `cooling_station_rated_power_kw` (double precision) - Total cooling station rated power in kW
      - `cooling_station_rated_power_mw` (double precision) - Total cooling station rated power in MW
      - `original_image_url` (text) - URL of original satellite/aerial image
      - `annotated_image_url` (text) - URL of annotated detection result image
      - `image_uploaded_at` (timestamptz) - When image was uploaded
      - `created_at` (timestamptz) - Record creation time
      - `updated_at` (timestamptz) - Record last update time

  2. Indexes
    - GiST spatial index on `geom` for map viewport queries
    - B-tree indexes on `probability_level`, `detection_status`, `has_cooling_tower`, `industry_category`

  3. Security
    - Enable RLS on `enterprises` table
    - Allow anonymous users to SELECT all data (public dashboard)
    - Allow authenticated users to INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS enterprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number text NOT NULL DEFAULT '',
  enterprise_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  industry_category text NOT NULL DEFAULT '',
  composite_score numeric DEFAULT 0,
  probability_level text NOT NULL DEFAULT '高',
  match_dimension_details jsonb DEFAULT '{}',

  longitude double precision,
  latitude double precision,
  geom extensions.geometry(Point, 4326),
  geocoding_status text NOT NULL DEFAULT 'pending',

  has_cooling_tower boolean DEFAULT false,
  cooling_tower_count integer DEFAULT 0,
  detection_confidence double precision DEFAULT 0,
  detection_status text NOT NULL DEFAULT 'pending',

  estimated_building_area double precision DEFAULT 0,
  unit_cooling_load double precision DEFAULT 0,
  peak_cooling_load double precision DEFAULT 0,
  total_cooling_capacity_rt double precision DEFAULT 0,
  chiller_count integer DEFAULT 0,
  single_unit_capacity_rt double precision DEFAULT 0,
  single_unit_rated_power_kw double precision DEFAULT 0,
  cooling_station_rated_power_kw double precision DEFAULT 0,
  cooling_station_rated_power_mw double precision DEFAULT 0,

  original_image_url text,
  annotated_image_url text,
  image_uploaded_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enterprises_geom ON enterprises USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_enterprises_probability ON enterprises (probability_level);
CREATE INDEX IF NOT EXISTS idx_enterprises_detection ON enterprises (detection_status);
CREATE INDEX IF NOT EXISTS idx_enterprises_cooling_tower ON enterprises (has_cooling_tower);
CREATE INDEX IF NOT EXISTS idx_enterprises_industry ON enterprises (industry_category);

ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to enterprises"
  ON enterprises
  FOR SELECT
  TO anon
  USING (geocoding_status IS NOT NULL);

CREATE POLICY "Allow authenticated read access to enterprises"
  ON enterprises
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated insert to enterprises"
  ON enterprises
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated update to enterprises"
  ON enterprises
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated delete from enterprises"
  ON enterprises
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
