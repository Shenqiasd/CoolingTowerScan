/*
  # Create Detection Results Table

  1. New Tables
    - `detection_results` - Stores individual cooling tower detection results from satellite image AI analysis
      - `id` (uuid, primary key) - Unique identifier
      - `enterprise_id` (uuid, FK) - Reference to the enterprise this detection belongs to
      - `account_number` (text) - 户号, electricity account number (for matching)
      - `image_path` (text) - Original image file path from detection system
      - `detection_id` (integer) - Detection index within the image (0, 1, 2...)
      - `confidence` (double precision) - AI detection confidence score (0-1)
      - `class_name` (text) - Detected object class (e.g., "cooling_tower")
      - `bbox_x1` (double precision) - Bounding box top-left x coordinate
      - `bbox_y1` (double precision) - Bounding box top-left y coordinate
      - `bbox_x2` (double precision) - Bounding box bottom-right x coordinate
      - `bbox_y2` (double precision) - Bounding box bottom-right y coordinate
      - `center_x` (double precision) - Bounding box center x coordinate
      - `center_y` (double precision) - Bounding box center y coordinate
      - `bbox_width` (double precision) - Bounding box width in pixels
      - `bbox_height` (double precision) - Bounding box height in pixels
      - `bbox_area` (double precision) - Bounding box area in pixels
      - `created_at` (timestamptz) - Record creation time

  2. Indexes
    - B-tree on `enterprise_id` for fast joins
    - B-tree on `account_number` for CSV import matching

  3. Security
    - Enable RLS on `detection_results` table
    - Allow anonymous read access
    - Allow anonymous insert/update for CSV import
*/

CREATE TABLE IF NOT EXISTS detection_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid REFERENCES enterprises(id) ON DELETE CASCADE,
  account_number text NOT NULL DEFAULT '',
  image_path text NOT NULL DEFAULT '',
  detection_id integer DEFAULT 0,
  confidence double precision DEFAULT 0,
  class_name text NOT NULL DEFAULT 'cooling_tower',
  bbox_x1 double precision DEFAULT 0,
  bbox_y1 double precision DEFAULT 0,
  bbox_x2 double precision DEFAULT 0,
  bbox_y2 double precision DEFAULT 0,
  center_x double precision DEFAULT 0,
  center_y double precision DEFAULT 0,
  bbox_width double precision DEFAULT 0,
  bbox_height double precision DEFAULT 0,
  bbox_area double precision DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detection_results_enterprise ON detection_results (enterprise_id);
CREATE INDEX IF NOT EXISTS idx_detection_results_account ON detection_results (account_number);

ALTER TABLE detection_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read detection_results"
  ON detection_results
  FOR SELECT
  TO anon
  USING (account_number IS NOT NULL);

CREATE POLICY "Allow anonymous insert detection_results"
  ON detection_results
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update detection_results"
  ON detection_results
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read detection_results"
  ON detection_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated insert detection_results"
  ON detection_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
