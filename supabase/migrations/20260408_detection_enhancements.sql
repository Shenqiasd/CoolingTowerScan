-- scan_screenshots 增加识别状态字段
ALTER TABLE scan_screenshots
  ADD COLUMN IF NOT EXISTS has_cooling_tower boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tower_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_confidence double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detection_status text DEFAULT 'pending'
    CHECK (detection_status IN ('pending', 'detected', 'no_result', 'error'));

-- detection_results 增加 screenshot_id FK
ALTER TABLE detection_results
  ADD COLUMN IF NOT EXISTS screenshot_id uuid REFERENCES scan_screenshots(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_detection_results_screenshot
  ON detection_results (screenshot_id);

-- 允许匿名删除（重跑识别时清理旧结果）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'detection_results'
      AND policyname = 'Allow anonymous delete detection_results'
  ) THEN
    CREATE POLICY "Allow anonymous delete detection_results"
      ON detection_results FOR DELETE TO anon USING (true);
  END IF;
END $$;
