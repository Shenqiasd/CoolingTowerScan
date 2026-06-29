/*
  # Atomic detection persistence

  Persists one screenshot detection result in a single database transaction:
  - replace detection_results for the screenshot
  - update scan_screenshots status
  - upsert scan_candidates and scan_candidate_evidences
  - recompute enterprise detection summary when the screenshot is linked

  The function is SECURITY DEFINER so the public scanning UI can write the
  whole detection bundle without direct table write privileges on candidates.
*/

CREATE OR REPLACE FUNCTION public.persist_detection_result(
  p_screenshot_id uuid,
  p_enterprise_id uuid,
  p_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_screenshot scan_screenshots%ROWTYPE;
  v_effective_enterprise_id uuid;
  v_has_tower boolean;
  v_count integer;
  v_confidence double precision;
  v_status text;
  v_source text;
  v_candidate_code text;
  v_candidate_id uuid;
  v_detection_rows jsonb := '[]'::jsonb;
  v_detection_row_count integer := 0;
  v_evidence_count integer := 0;
  v_enterprise_name text := '';
  v_enterprise_address text := '';
  v_enterprise_industry text := '';
  v_enterprise_detection_count integer := 0;
  v_enterprise_confidence double precision := 0;
  v_total_area_m2 double precision := 0;
  v_avg_area_m2 double precision := 0;
  v_max_area_m2 double precision := 0;
  v_capacity_rt double precision := 0;
  v_peak_kw double precision := 0;
  v_building_area double precision := 0;
  v_chiller_count integer := 0;
  v_single_rt double precision := 0;
  v_single_kw double precision := 0;
  v_station_kw double precision := 0;
BEGIN
  IF p_screenshot_id IS NULL THEN
    RAISE EXCEPTION 'screenshot id is required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_screenshot
  FROM scan_screenshots
  WHERE id = p_screenshot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scan_screenshot not found: %', p_screenshot_id USING ERRCODE = 'P0002';
  END IF;

  v_effective_enterprise_id := COALESCE(p_enterprise_id, v_screenshot.enterprise_id);
  v_has_tower := COALESCE((p_result->>'has_cooling_tower')::boolean, false);
  v_count := COALESCE(NULLIF(p_result->>'count', '')::integer, jsonb_array_length(COALESCE(p_result->'detections', '[]'::jsonb)));
  v_confidence := COALESCE(NULLIF(p_result->>'confidence', '')::double precision, 0);
  v_status := CASE WHEN v_has_tower AND v_count > 0 THEN 'detected' ELSE 'no_result' END;
  v_source := CASE WHEN COALESCE(v_screenshot.address_label, '') <> '' THEN 'address' ELSE 'area' END;

  UPDATE scan_screenshots
  SET
    enterprise_id = COALESCE(v_effective_enterprise_id, enterprise_id),
    has_cooling_tower = v_has_tower,
    tower_count = v_count,
    max_confidence = v_confidence,
    detection_status = v_status
  WHERE id = p_screenshot_id;

  DELETE FROM detection_results
  WHERE screenshot_id = p_screenshot_id;

  WITH detection_input AS (
    SELECT
      elem,
      ordinality - 1 AS detection_index
    FROM jsonb_array_elements(COALESCE(p_result->'detections', '[]'::jsonb)) WITH ORDINALITY AS items(elem, ordinality)
  ),
  inserted AS (
    INSERT INTO detection_results (
      screenshot_id,
      enterprise_id,
      account_number,
      image_path,
      detection_id,
      confidence,
      class_name,
      bbox_x1,
      bbox_y1,
      bbox_x2,
      bbox_y2,
      center_x,
      center_y,
      bbox_width,
      bbox_height,
      bbox_area
    )
    SELECT
      p_screenshot_id,
      v_effective_enterprise_id,
      '',
      p_screenshot_id::text,
      detection_index,
      COALESCE(NULLIF(elem->>'confidence', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'class_name', ''), 'cooling_tower'),
      COALESCE(NULLIF(elem->>'x1', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'y1', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'x2', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'y2', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'center_x', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'center_y', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'width', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'height', '')::double precision, 0),
      COALESCE(NULLIF(elem->>'width', '')::double precision, 0)
        * COALESCE(NULLIF(elem->>'height', '')::double precision, 0)
    FROM detection_input
    RETURNING id, screenshot_id, confidence, bbox_area, detection_id
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(inserted) ORDER BY detection_id), '[]'::jsonb),
    count(*)
  INTO v_detection_rows, v_detection_row_count
  FROM inserted;

  v_candidate_code := CASE
    WHEN v_effective_enterprise_id IS NOT NULL THEN
      'SC-' || substring(v_screenshot.session_id::text from 1 for 8) || '-' || substring(v_effective_enterprise_id::text from 1 for 8)
    ELSE
      'SC-' || substring(v_screenshot.session_id::text from 1 for 8) || '-SS-' || substring(p_screenshot_id::text from 1 for 8)
  END;

  IF v_has_tower AND v_count > 0 AND v_screenshot.session_id IS NOT NULL THEN
    IF v_effective_enterprise_id IS NOT NULL THEN
      SELECT enterprise_name, address, industry_category
      INTO v_enterprise_name, v_enterprise_address, v_enterprise_industry
      FROM enterprises
      WHERE id = v_effective_enterprise_id;
    END IF;

    INSERT INTO scan_candidates (
      candidate_code,
      scan_session_id,
      enterprise_id,
      site_id,
      status,
      source_type,
      source_label,
      matched_enterprise_name,
      matched_address,
      cooling_tower_count,
      total_tower_area_m2,
      total_tower_bbox_area_px,
      estimated_capacity_rt,
      estimated_cooling_station_power_kw,
      confidence_score,
      review_note,
      rejection_reason,
      source_payload,
      hvac_estimate_snapshot,
      created_by
    )
    VALUES (
      v_candidate_code,
      v_screenshot.session_id,
      v_effective_enterprise_id,
      null,
      CASE WHEN v_effective_enterprise_id IS NULL THEN 'under_review' ELSE 'approved' END,
      'cooling_tower_scan',
      CASE WHEN v_source = 'address' THEN 'address_scan_detection' ELSE 'area_scan_detection' END,
      COALESCE(NULLIF(v_enterprise_name, ''), NULLIF(v_screenshot.address_label, ''), NULLIF(v_screenshot.resolved_address, ''), v_screenshot.filename),
      COALESCE(NULLIF(v_enterprise_address, ''), NULLIF(v_screenshot.resolved_address, ''), NULLIF(v_screenshot.address_label, ''), v_screenshot.filename),
      v_count,
      0,
      COALESCE((
        SELECT sum((row->>'bbox_area')::double precision)
        FROM jsonb_array_elements(v_detection_rows) AS row
      ), 0),
      0,
      0,
      v_confidence,
      '',
      '',
      jsonb_build_object(
        'screenshotId', p_screenshot_id,
        'filename', v_screenshot.filename,
        'source', v_source,
        'lng', v_screenshot.lng,
        'lat', v_screenshot.lat,
        'storageUrl', v_screenshot.storage_url
      ),
      '{}'::jsonb,
      null
    )
    ON CONFLICT (candidate_code)
    DO UPDATE SET
      scan_session_id = EXCLUDED.scan_session_id,
      enterprise_id = EXCLUDED.enterprise_id,
      status = EXCLUDED.status,
      source_label = EXCLUDED.source_label,
      matched_enterprise_name = EXCLUDED.matched_enterprise_name,
      matched_address = EXCLUDED.matched_address,
      cooling_tower_count = EXCLUDED.cooling_tower_count,
      total_tower_bbox_area_px = EXCLUDED.total_tower_bbox_area_px,
      confidence_score = EXCLUDED.confidence_score,
      source_payload = EXCLUDED.source_payload,
      updated_at = now()
    RETURNING id INTO v_candidate_id;

    DELETE FROM scan_candidate_evidences
    WHERE candidate_id = v_candidate_id;

    INSERT INTO scan_candidate_evidences (
      candidate_id,
      screenshot_id,
      detection_result_id,
      kind,
      sort_order,
      metadata
    )
    VALUES (
      v_candidate_id,
      p_screenshot_id,
      null,
      'original',
      0,
      '{}'::jsonb
    );

    INSERT INTO scan_candidate_evidences (
      candidate_id,
      screenshot_id,
      detection_result_id,
      kind,
      sort_order,
      metadata
    )
    SELECT
      v_candidate_id,
      p_screenshot_id,
      (row->>'id')::uuid,
      'bbox',
      row_number() OVER (ORDER BY (row->>'detection_id')::integer),
      jsonb_build_object(
        'confidence', COALESCE((row->>'confidence')::double precision, 0),
        'bboxArea', COALESCE((row->>'bbox_area')::double precision, 0)
      )
    FROM jsonb_array_elements(v_detection_rows) AS row;

    GET DIAGNOSTICS v_evidence_count = ROW_COUNT;
    v_evidence_count := v_evidence_count + 1;
  ELSE
    DELETE FROM scan_candidates
    WHERE candidate_code = v_candidate_code;
  END IF;

  IF v_effective_enterprise_id IS NOT NULL THEN
    SELECT industry_category
    INTO v_enterprise_industry
    FROM enterprises
    WHERE id = v_effective_enterprise_id;

    WITH enterprise_detections AS (
      SELECT
        dr.confidence,
        dr.bbox_area,
        ss.lat,
        sess.zoom_level,
        CASE
          WHEN ss.lat IS NULL OR sess.zoom_level IS NULL THEN 0
          ELSE dr.bbox_area * power(
            (40075016.686 * cos((ss.lat * pi()) / 180)) / (512 * power(2, sess.zoom_level)),
            2
          )
        END AS area_m2
      FROM detection_results dr
      LEFT JOIN scan_screenshots ss ON ss.id = dr.screenshot_id
      LEFT JOIN scan_sessions sess ON sess.id = ss.session_id
      WHERE dr.enterprise_id = v_effective_enterprise_id
    )
    SELECT
      count(*),
      COALESCE(max(confidence), 0),
      COALESCE(sum(area_m2), 0),
      COALESCE(avg(area_m2), 0),
      COALESCE(max(area_m2), 0)
    INTO
      v_enterprise_detection_count,
      v_enterprise_confidence,
      v_total_area_m2,
      v_avg_area_m2,
      v_max_area_m2
    FROM enterprise_detections;

    IF v_enterprise_detection_count <= 0 THEN
      UPDATE enterprises
      SET
        has_cooling_tower = false,
        cooling_tower_count = 0,
        detection_confidence = 0,
        detection_status = 'no_result',
        detected_tower_total_area_m2 = 0,
        detected_tower_avg_area_m2 = 0,
        detected_tower_max_area_m2 = 0,
        estimated_building_area = 0,
        unit_cooling_load = 0,
        peak_cooling_load = 0,
        total_cooling_capacity_rt = 0,
        chiller_count = 0,
        single_unit_capacity_rt = 0,
        single_unit_rated_power_kw = 0,
        cooling_station_rated_power_kw = 0,
        cooling_station_rated_power_mw = 0,
        hvac_estimate_details = jsonb_build_object('method', 'none', 'tower_count', 0),
        updated_at = now()
      WHERE id = v_effective_enterprise_id;
    ELSE
      v_capacity_rt := CASE
        WHEN v_total_area_m2 > 0 THEN
          (v_enterprise_detection_count * 350 * 0.35) + (v_total_area_m2 * 18 * 0.65)
        ELSE
          v_enterprise_detection_count * 350
      END;
      v_peak_kw := v_capacity_rt * 3.517;
      v_building_area := (v_peak_kw * 1000) / 130;
      v_chiller_count := GREATEST(1, CEIL(v_capacity_rt / 350)::integer);
      v_single_rt := v_capacity_rt / v_chiller_count;
      v_single_kw := (v_single_rt * 3.517) / 5.8;
      v_station_kw := v_single_kw * v_chiller_count;

      UPDATE enterprises
      SET
        has_cooling_tower = true,
        cooling_tower_count = v_enterprise_detection_count,
        detection_confidence = v_enterprise_confidence,
        detection_status = 'detected',
        detected_tower_total_area_m2 = round(v_total_area_m2::numeric, 2)::double precision,
        detected_tower_avg_area_m2 = round(v_avg_area_m2::numeric, 2)::double precision,
        detected_tower_max_area_m2 = round(v_max_area_m2::numeric, 2)::double precision,
        estimated_building_area = round(v_building_area)::double precision,
        unit_cooling_load = 130,
        peak_cooling_load = round((v_peak_kw)::numeric, 1)::double precision,
        total_cooling_capacity_rt = round((v_capacity_rt)::numeric, 1)::double precision,
        chiller_count = v_chiller_count,
        single_unit_capacity_rt = round(v_single_rt)::double precision,
        single_unit_rated_power_kw = round(v_single_kw)::double precision,
        cooling_station_rated_power_kw = round(v_station_kw)::double precision,
        cooling_station_rated_power_mw = round((v_station_kw / 1000)::numeric, 2)::double precision,
        hvac_estimate_details = jsonb_build_object(
          'method', CASE WHEN v_total_area_m2 > 0 THEN 'count-and-size' ELSE 'count-only' END,
          'tower_count', v_enterprise_detection_count,
          'detected_tower_total_area_m2', round(v_total_area_m2::numeric, 2),
          'detected_tower_avg_area_m2', round(v_avg_area_m2::numeric, 2),
          'detected_tower_max_area_m2', round(v_max_area_m2::numeric, 2),
          'industry_category', COALESCE(v_enterprise_industry, ''),
          'assumptions', jsonb_build_object(
            'heat_rejection_factor', 1.25,
            'count_based_rt_per_tower', jsonb_build_object('typical', 350),
            'tower_rt_per_m2', jsonb_build_object('typical', 18)
          )
        ),
        updated_at = now()
      WHERE id = v_effective_enterprise_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'screenshotId', p_screenshot_id,
    'status', v_status,
    'hasCoolingTower', v_has_tower,
    'count', v_count,
    'confidence', v_confidence,
    'enterpriseId', v_effective_enterprise_id,
    'candidateId', v_candidate_id,
    'candidateStatus', CASE
      WHEN v_candidate_id IS NULL THEN null
      WHEN v_effective_enterprise_id IS NULL THEN 'under_review'
      ELSE 'approved'
    END,
    'detectionRowCount', v_detection_row_count,
    'evidenceCount', v_evidence_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.persist_detection_result(uuid, uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.persist_detection_result(uuid, uuid, jsonb) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_candidates' AND policyname = 'anon_read_scan_candidates'
  ) THEN
    CREATE POLICY "anon_read_scan_candidates"
      ON scan_candidates FOR SELECT TO anon
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_candidates' AND policyname = 'anon_update_scan_candidates'
  ) THEN
    CREATE POLICY "anon_update_scan_candidates"
      ON scan_candidates FOR UPDATE TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_candidate_evidences' AND policyname = 'anon_read_scan_candidate_evidences'
  ) THEN
    CREATE POLICY "anon_read_scan_candidate_evidences"
      ON scan_candidate_evidences FOR SELECT TO anon
      USING (true);
  END IF;
END $$;
