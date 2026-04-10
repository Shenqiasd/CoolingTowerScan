ALTER TABLE scan_screenshots
  ADD COLUMN IF NOT EXISTS resolved_address text;

CREATE INDEX IF NOT EXISTS idx_scan_screenshots_resolved_address
  ON scan_screenshots (resolved_address)
  WHERE resolved_address IS NOT NULL;
