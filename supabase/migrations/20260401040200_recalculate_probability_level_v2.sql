/*
  # Recalculate probability_level using v2 formula

  ## Summary
  Replaces the old single-value probability_level ('高') with a proper 3-tier
  classification based on two dimensions:
    1. Satellite image cooling tower detection result (detection_status + cooling_tower_count)
    2. Industry sub-category (sub_category)

  ## New Values
  - '高' = High probability
  - '中等' = Medium probability
  - '低' = Low probability

  ## Classification Rules (applied in priority order, first match wins)

  ### High Probability (H1–H4)
  - H1: cooling_tower_count >= 2 (multiple cooling towers detected)
  - H2: cooling_tower_count = 1 AND sub_category IN high-demand industries
  - H3: detection_status = 'no_result' AND sub_category IN high-demand industries
  - H4: detection_status = 'pending' AND sub_category IN high-demand industries

  High-demand industries: 医药生物, 数据中心/IT, 医院, 电子电器, 办公楼宇,
    零售商场, 食品饮料, 住宿餐饮, 汽车制造, 金融

  ### Medium Probability (M1–M3, only if not already High)
  - M1: cooling_tower_count = 1 AND sub_category IN medium-demand industries
  - M2: detection_status = 'pending' AND sub_category NOT IN high-demand industries
  - M3: detection_status = 'no_result' AND sub_category IN medium-high industries
    (科研机构, 酒店, 房地产, 电力能源, 商务服务)

  ### Low Probability
  - All remaining enterprises

  ## Modified Columns
  - `probability_level`: updated from all-'高' to proper 3-tier values

  ## Notes
  - No data is deleted or destroyed
  - This is a pure UPDATE operation on probability_level column
*/

UPDATE enterprises
SET probability_level = CASE

  -- H1: multiple cooling towers → High
  WHEN cooling_tower_count >= 2
    THEN '高'

  -- H2: 1 cooling tower + high-demand industry → High
  WHEN cooling_tower_count = 1
    AND sub_category IN ('医药生物', '数据中心/IT', '医院', '电子电器', '办公楼宇',
                          '零售商场', '食品饮料', '住宿餐饮', '汽车制造', '金融')
    THEN '高'

  -- H3: no cooling tower (no_result) + high-demand industry → High
  WHEN detection_status = 'no_result'
    AND sub_category IN ('医药生物', '数据中心/IT', '医院', '电子电器', '办公楼宇',
                          '零售商场', '食品饮料', '住宿餐饮', '汽车制造', '金融')
    THEN '高'

  -- H4: pending detection + high-demand industry → High
  WHEN detection_status = 'pending'
    AND sub_category IN ('医药生物', '数据中心/IT', '医院', '电子电器', '办公楼宇',
                          '零售商场', '食品饮料', '住宿餐饮', '汽车制造', '金融')
    THEN '高'

  -- M1: 1 cooling tower + medium-demand industry → Medium
  WHEN cooling_tower_count = 1
    AND sub_category IN ('科研机构', '酒店', '房地产', '商务服务', '电力能源', '化工',
                          '纺织服装', '交通运输', '其他制造业', '物流仓储', '机械装备',
                          '高等院校', '冶金金属', '批发市场', '文娱', '商业综合体',
                          '采矿', '社会福利')
    THEN '中等'

  -- M2: pending detection + non-high-demand industry → Medium
  WHEN detection_status = 'pending'
    AND sub_category NOT IN ('医药生物', '数据中心/IT', '医院', '电子电器', '办公楼宇',
                              '零售商场', '食品饮料', '住宿餐饮', '汽车制造', '金融')
    THEN '中等'

  -- M3: no cooling tower + medium-high industry (5 types) → Medium
  WHEN detection_status = 'no_result'
    AND sub_category IN ('科研机构', '酒店', '房地产', '电力能源', '商务服务')
    THEN '中等'

  -- All others → Low
  ELSE '低'

END;
