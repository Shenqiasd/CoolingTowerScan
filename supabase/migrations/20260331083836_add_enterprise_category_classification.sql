/*
  # Add Enterprise Category Classification

  ## Summary
  Adds two new classification columns to the enterprises table and auto-classifies
  all existing records based on enterprise name and industry_category.

  ## New Columns
  - `major_category` (text): Top-level classification
    - '工业企业': Industrial enterprises (manufacturing, mining, utilities, etc.)
    - '公建建筑': Public/commercial buildings (hospitals, schools, hotels, etc.)
  - `sub_category` (text): Sub-level classification
    - For 工业企业: industry sub-type (e.g., 制造业, 电力能源, 化工, etc.)
    - For 公建建筑: building type (e.g., 医院, 学校, 酒店, 商业综合体, etc.)

  ## Classification Logic
  1. 工业企业 industries: 制造业, 采矿业, 电力/热力/燃气/水生产供应业, 建筑业, 农林牧渔业
  2. 公建建筑 industries: 教育, 卫生和社会工作, 住宿和餐饮业, 金融业, 文化体育娱乐, etc.
  3. For ambiguous categories, name-based keyword matching is used.
  4. Sub-categories are derived from industry + name keywords for finer granularity.
*/

-- Step 1: Add the new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enterprises' AND column_name = 'major_category'
  ) THEN
    ALTER TABLE enterprises ADD COLUMN major_category text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enterprises' AND column_name = 'sub_category'
  ) THEN
    ALTER TABLE enterprises ADD COLUMN sub_category text DEFAULT '' NOT NULL;
  END IF;
END $$;

-- Step 2: Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_enterprises_major_category ON enterprises(major_category);
CREATE INDEX IF NOT EXISTS idx_enterprises_sub_category ON enterprises(sub_category);

-- Step 3: Classify all existing enterprises
UPDATE enterprises
SET
  major_category = CASE
    -- Clearly industrial industries
    WHEN industry_category IN ('制造业', '采矿业', '建筑业', '农、林、牧、渔业', '电力、热力、燃气及水生产和供应业')
      THEN '工业企业'
    -- Clearly public/commercial building industries
    WHEN industry_category IN ('教育', '卫生和社会工作', '住宿和餐饮业', '金融业', '文化、体育和娱乐业',
      '公共管理、社会保障和社会组织', '房地产业', '科学研究和技术服务业',
      '信息传输、软件和信息技术服务业', '居民服务、修理和其他服务业',
      '租赁和商务服务业', '批发和零售业', '水利、环境和公共设施管理业', '国际组织')
      THEN '公建建筑'
    -- Transport/logistics — check name for industrial hints
    WHEN industry_category = '交通运输、仓储和邮政业' THEN
      CASE
        WHEN enterprise_name ~* '(工厂|生产|制造|加工|仓储|物流|运输|货运|码头|港口|机场|铁路)'
          THEN '工业企业'
        ELSE '公建建筑'
      END
    -- Unknown — use name-based heuristics
    WHEN industry_category = '未知' OR industry_category IS NULL OR industry_category = '' THEN
      CASE
        WHEN enterprise_name ~* '(医院|诊所|卫生院|卫生中心|疾控|急救|血液|眼科|口腔|妇产|儿童医院|肿瘤|康复)'
          THEN '公建建筑'
        WHEN enterprise_name ~* '(学校|大学|学院|中学|小学|幼儿园|培训|教育|研究院|科学院)'
          THEN '公建建筑'
        WHEN enterprise_name ~* '(酒店|宾馆|旅馆|旅社|度假|民宿|招待所|公寓)'
          THEN '公建建筑'
        WHEN enterprise_name ~* '(商场|超市|百货|购物|广场|市场|商业|商务|写字楼|办公楼)'
          THEN '公建建筑'
        WHEN enterprise_name ~* '(工厂|制造|加工|生产|化工|钢铁|冶金|铸造|电力|能源|矿山|采矿)'
          THEN '工业企业'
        ELSE '公建建筑'
      END
    ELSE '公建建筑'
  END,
  sub_category = CASE
    -- Industrial sub-categories
    WHEN industry_category = '制造业' THEN
      CASE
        WHEN enterprise_name ~* '(汽车|整车|零部件|发动机|变速箱)' THEN '汽车制造'
        WHEN enterprise_name ~* '(电子|半导体|芯片|集成电路|光电|显示|电器)' THEN '电子电器'
        WHEN enterprise_name ~* '(化工|化学|塑料|橡胶|涂料|树脂|聚合|溶剂)' THEN '化工'
        WHEN enterprise_name ~* '(钢铁|冶金|铸造|金属|铝|铜|不锈钢)' THEN '冶金金属'
        WHEN enterprise_name ~* '(食品|饮料|乳业|酿酒|粮油|调味|烘焙|水产|肉类)' THEN '食品饮料'
        WHEN enterprise_name ~* '(纺织|服装|面料|印染|棉|丝|化纤)' THEN '纺织服装'
        WHEN enterprise_name ~* '(医药|医疗器械|生物技术|制药|药业)' THEN '医药生物'
        WHEN enterprise_name ~* '(机械|设备|装备|工程机械|数控|模具|阀门|泵|压缩机)' THEN '机械装备'
        WHEN enterprise_name ~* '(包装|纸业|印刷|纸箱|塑包)' THEN '包装印刷'
        WHEN enterprise_name ~* '(建材|水泥|玻璃|陶瓷|石材|砖瓦)' THEN '建材'
        ELSE '其他制造业'
      END
    WHEN industry_category = '采矿业' THEN '采矿'
    WHEN industry_category = '建筑业' THEN '建筑施工'
    WHEN industry_category IN ('农、林、牧、渔业') THEN '农林牧渔'
    WHEN industry_category = '电力、热力、燃气及水生产和供应业' THEN '电力能源'
    WHEN industry_category = '交通运输、仓储和邮政业' AND
      enterprise_name ~* '(工厂|生产|制造|加工|仓储|物流|运输|货运|码头|港口|机场|铁路)' THEN '物流仓储'

    -- Public building sub-categories by industry
    WHEN industry_category = '卫生和社会工作' THEN
      CASE
        WHEN enterprise_name ~* '(医院|诊所|卫生院|卫生中心|疾控|急救|血液|眼科|口腔|妇产|儿童医院|肿瘤|康复)' THEN '医院'
        WHEN enterprise_name ~* '(养老|福利院|敬老|孤儿|残疾|残联|社会福利)' THEN '社会福利'
        ELSE '卫生机构'
      END
    WHEN industry_category = '教育' THEN
      CASE
        WHEN enterprise_name ~* '(大学|学院|高校)' THEN '高等院校'
        WHEN enterprise_name ~* '(中学|高中|初中|职业技术|职高|技校)' THEN '中学'
        WHEN enterprise_name ~* '(小学|幼儿园|托儿所)' THEN '小学/幼儿园'
        WHEN enterprise_name ~* '(培训|驾校|补习|辅导)' THEN '培训机构'
        ELSE '其他教育'
      END
    WHEN industry_category = '住宿和餐饮业' THEN
      CASE
        WHEN enterprise_name ~* '(酒店|宾馆|旅馆|度假|招待所|民宿)' THEN '酒店'
        WHEN enterprise_name ~* '(餐饮|餐厅|饭店|食堂|厨房)' THEN '餐饮'
        ELSE '住宿餐饮'
      END
    WHEN industry_category = '金融业' THEN '金融'
    WHEN industry_category = '文化、体育和娱乐业' THEN
      CASE
        WHEN enterprise_name ~* '(体育|运动|健身|游泳|球场|场馆)' THEN '体育场馆'
        WHEN enterprise_name ~* '(影院|剧院|剧场|演艺|展览|博物馆|图书馆|文化馆)' THEN '文化场馆'
        ELSE '文娱'
      END
    WHEN industry_category = '房地产业' THEN
      CASE
        WHEN enterprise_name ~* '(商场|购物|超市|百货|广场|零售)' THEN '商业综合体'
        WHEN enterprise_name ~* '(写字楼|办公楼|商务|园区|总部|大厦)' THEN '办公楼宇'
        WHEN enterprise_name ~* '(住宅|公寓|小区|社区|楼盘|花园|别墅)' THEN '住宅小区'
        ELSE '房地产'
      END
    WHEN industry_category = '公共管理、社会保障和社会组织' THEN '政府机关'
    WHEN industry_category = '科学研究和技术服务业' THEN '科研机构'
    WHEN industry_category IN ('信息传输、软件和信息技术服务业') THEN '数据中心/IT'
    WHEN industry_category IN ('批发和零售业') THEN
      CASE
        WHEN enterprise_name ~* '(超市|商场|百货|购物|零售)' THEN '零售商场'
        ELSE '批发市场'
      END
    WHEN industry_category = '租赁和商务服务业' THEN '商务服务'
    WHEN industry_category IN ('水利、环境和公共设施管理业') THEN '公共设施'
    WHEN industry_category = '交通运输、仓储和邮政业' THEN '交通运输'
    WHEN industry_category = '居民服务、修理和其他服务业' THEN '社区服务'
    WHEN industry_category = '国际组织' THEN '国际机构'

    -- Unknown — name-based
    ELSE
      CASE
        WHEN enterprise_name ~* '(医院|诊所|卫生院)' THEN '医院'
        WHEN enterprise_name ~* '(大学|学院|学校)' THEN '学校'
        WHEN enterprise_name ~* '(酒店|宾馆|旅馆)' THEN '酒店'
        WHEN enterprise_name ~* '(商场|购物中心|超市|广场)' THEN '商业综合体'
        WHEN enterprise_name ~* '(工厂|制造|化工)' THEN '工业厂房'
        ELSE '其他'
      END
  END;
