/*
  # Batch HVAC Estimation for All Enterprises

  1. What this does
    - Estimates HVAC parameters for all 8664 enterprises based on industry type and composite score
    - Uses standard HVAC engineering formulas:
      - Building area estimated from composite_score (higher score = larger building)
      - Unit cooling load (W/m2) based on industry category lookup table
      - Peak cooling load = area * unit load
      - Total cooling capacity in RT (1 RT = 3.517 kW)
      - Chiller count derived from total capacity / 350 RT per unit
      - Power calculated using COP of 5.8

  2. Modified Tables
    - `enterprises`: Updates all HVAC estimation columns for records where estimated_building_area = 0

  3. Important Notes
    - Only updates records that haven't been manually estimated yet (estimated_building_area = 0)
    - Does NOT overwrite manually entered data
    - Uses deterministic hash from enterprise id for consistent randomization
*/

UPDATE enterprises
SET
  estimated_building_area = ROUND(
    CASE
      WHEN probability_level = '高' THEN 8000
      ELSE 4000
    END
    * (
      CASE
        WHEN composite_score > 0 THEN 1.0 + (composite_score::float / 100.0) * 2.0
        ELSE 0.8 + (MOD(ABS(hashtext(id::text)), 400)::float / 1000.0)
      END
    )
  ),
  unit_cooling_load = CASE
    WHEN industry_category LIKE '%商场%' OR industry_category LIKE '%商业%' THEN 200
    WHEN industry_category LIKE '%餐饮%' THEN 250
    WHEN industry_category LIKE '%数据中心%' THEN 450
    WHEN industry_category LIKE '%通信%' THEN 300
    WHEN industry_category LIKE '%信息%' OR industry_category LIKE '%软件%' THEN 220
    WHEN industry_category LIKE '%医院%' OR industry_category LIKE '%医疗%' OR industry_category LIKE '%卫生%' THEN 200
    WHEN industry_category LIKE '%酒店%' OR industry_category LIKE '%宾馆%' OR industry_category LIKE '%住宿%' THEN 150
    WHEN industry_category LIKE '%体育%' THEN 150
    WHEN industry_category LIKE '%金融%' THEN 150
    WHEN industry_category LIKE '%零售%' OR industry_category LIKE '%批发%' THEN 140
    WHEN industry_category LIKE '%办公%' OR industry_category LIKE '%租赁%' THEN 120
    WHEN industry_category LIKE '%房地产%' THEN 130
    WHEN industry_category LIKE '%科学%' OR industry_category LIKE '%科技%' THEN 130
    WHEN industry_category LIKE '%交通%' THEN 130
    WHEN industry_category LIKE '%文化%' THEN 120
    WHEN industry_category LIKE '%工厂%' OR industry_category LIKE '%制造%' OR industry_category LIKE '%工业%' THEN 110
    WHEN industry_category LIKE '%电力%' THEN 110
    WHEN industry_category LIKE '%教育%' OR industry_category LIKE '%学校%' THEN 100
    WHEN industry_category LIKE '%物流%' THEN 80
    WHEN industry_category LIKE '%住宅%' THEN 80
    WHEN industry_category LIKE '%水利%' THEN 80
    WHEN industry_category LIKE '%仓储%' THEN 60
    ELSE 130
  END,
  updated_at = now()
WHERE estimated_building_area = 0;

UPDATE enterprises
SET
  peak_cooling_load = ROUND((estimated_building_area * unit_cooling_load / 1000.0)::numeric, 1),
  updated_at = now()
WHERE peak_cooling_load = 0 AND estimated_building_area > 0;

UPDATE enterprises
SET
  total_cooling_capacity_rt = ROUND((peak_cooling_load / 3.517)::numeric, 1),
  updated_at = now()
WHERE total_cooling_capacity_rt = 0 AND peak_cooling_load > 0;

UPDATE enterprises
SET
  chiller_count = GREATEST(1, CEIL(total_cooling_capacity_rt / 350.0)),
  updated_at = now()
WHERE chiller_count = 0 AND total_cooling_capacity_rt > 0;

UPDATE enterprises
SET
  single_unit_capacity_rt = ROUND(total_cooling_capacity_rt / chiller_count),
  updated_at = now()
WHERE single_unit_capacity_rt = 0 AND chiller_count > 0;

UPDATE enterprises
SET
  single_unit_rated_power_kw = ROUND((single_unit_capacity_rt * 3.517 / 5.8)::numeric),
  updated_at = now()
WHERE single_unit_rated_power_kw = 0 AND single_unit_capacity_rt > 0;

UPDATE enterprises
SET
  cooling_station_rated_power_kw = ROUND(single_unit_rated_power_kw * chiller_count),
  cooling_station_rated_power_mw = ROUND((single_unit_rated_power_kw * chiller_count / 1000.0)::numeric, 2),
  updated_at = now()
WHERE cooling_station_rated_power_kw = 0 AND single_unit_rated_power_kw > 0;
