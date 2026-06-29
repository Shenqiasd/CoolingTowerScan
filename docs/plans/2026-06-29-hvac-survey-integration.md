# HVAC Survey Integration Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Lab 的“四川空调数据应用 + 暖通节能测算”能力整合进 CoolingTowerScan 的“探勘调研”模块，并在 Railway 部署后形成从收资、审核、设备建模、节能测算到方案交接的业务闭环。

**Architecture:** 以当前项目的 `survey` 阶段为主入口，新增暖通调研子域模型，不直接照搬 Lab Java 后端。后端继续使用 Fastify + Supabase，文件、识别结果、设备资产和月度模型都落库；前端把当前 `Survey Workspace` 升级为多 Tab 工作台；方案中心从探勘调研读取可审计的月度设备模型作为正式测算依据，保留 RT/COP 快速估算作为兜底。

**Tech Stack:** React 18, Vite, TypeScript, Fastify, Supabase Postgres, Supabase Storage, Vitest, Railway.

---

## Source Findings To Preserve

- Lab frontend `ui-sichuan-agent` 的业务三步是：数据收资、能效评估、方案生成。
- Lab backend `hvac-energy-saving-cal` 的有效代码在 `dev` / `ali` 分支，`main` 基本只有 README。
- Lab 的核心流水线是：冷冻站 -> 资料文件 -> AI/OCR 识别 -> 人工审核 -> 设备库/运行记录 -> 月度运行模型 -> 节能模式 -> 方案报告。
- 当前 CoolingTowerScan 的 `Survey Workspace` 只有基础信息、调研记录、简单设备台账、缺口、交接，缺少文件证据、识别审核、冷冻站、正式设备资产、运行月表。
- 不能照搬的 Lab 风险：`unknown` / `unknow` 混用，`loadRate` 单位混乱，导入全量删除重建，`schemeType` / `strategy` 命名混淆，设备完整性 gate 过弱。

## Product Acceptance Criteria

1. Railway 前端进入项目详情后，“探勘调研”区域显示这些子模块：
   - 概览
   - 冷冻站
   - 资料收资
   - 识别审核
   - 设备台账
   - 运行建模
   - 节能测算
   - 缺口与交接
2. 用户可以创建冷冻站，上传或登记资料文件，生成待审核结构化数据。
3. 用户可以人工审核/修正识别结果，审核通过后写入正式设备资产和运行记录。
4. 用户可以维护 12 个月设备运行模型，包含开启台数、运行天数、日运行小时、负荷率。
5. 用户可以选择节能模式并计算年度节电量、节能收益、节能率。
6. Survey 完成 gate 必须检查冷冻站、已审核设备、月度模型、未关闭缺口和交接包，不能只检查简单台账。
7. 方案中心可以读取探勘调研输出的数据包，使用正式月度设备模型进行测算；缺数据时才回退 RT/COP 快速估算。
8. Railway 部署后 API `/health` 能报告 Supabase、Storage、可选 AI provider 的状态；AI 未配置时不能显示“正在自动识别”假成功。
9. 所有导入操作必须先校验后替换，不允许失败后丢历史数据。

## Data Decisions

- 设备类型统一使用：
  - `chiller`
  - `chilled_water_pump`
  - `cooling_water_pump`
  - `cooling_tower`
  - `unknown`
- 负荷率统一存储为 `load_rate_pct`，范围 `0 <= value <= 100`。导入 `0.75` 时自动规范化为 `75`，导入 `75%` 和 `75` 也保存为 `75`。
- 节能模式使用 `saving_mode`：
  - `winter`
  - `balanced`
  - `summer`
  - `extreme`
- 设备运行策略使用 `operation_strategy`：
  - `full_year`
  - `partial_year`
- 文件识别要保存四层信息：
  - 原文件
  - 原始识别 JSON
  - 人工审核后的结构化数据
  - 正式业务资产

---

### Task 1: Add HVAC Survey Database Schema

**Files:**
- Create: `supabase/migrations/20260629090000_hvac_survey_workspace.sql`
- Modify: `api/src/modules/projects/project.schemas.ts`
- Test: `api/test/projects.test.ts`

**Step 1: Write schema expectations in API tests**

Add type-level fixtures to `api/test/projects.test.ts` for the new workspace shape:

```ts
const HVAC_SURVEY_WORKSPACE = {
  projectId: 'project-1',
  stations: [{ id: 'station-1', name: '1# 冷冻站', locationLabel: '动力站一层' }],
  files: [],
  reviewItems: [],
  equipmentAssets: [],
  monthlyProfiles: [],
  evaluation: null,
  gateValidation: { canComplete: false, errors: [] },
};
```

**Step 2: Create migration**

Create these tables:

```sql
CREATE TABLE IF NOT EXISTS project_cooling_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_label text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_survey_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  station_id uuid REFERENCES project_cooling_stations(id) ON DELETE SET NULL,
  file_type text NOT NULL CHECK (file_type IN ('device_nameplate', 'device_ledger', 'operation_record', 'site_photo', 'other')),
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'survey-files',
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  extraction_status text NOT NULL DEFAULT 'uploaded'
    CHECK (extraction_status IN ('uploaded', 'extracting', 'needs_review', 'reviewed', 'failed')),
  confidence numeric,
  error_message text NOT NULL DEFAULT '',
  raw_extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_hvac_equipment_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  station_id uuid REFERENCES project_cooling_stations(id) ON DELETE SET NULL,
  source_file_id uuid REFERENCES project_survey_files(id) ON DELETE SET NULL,
  device_type text NOT NULL DEFAULT 'unknown'
    CHECK (device_type IN ('chiller', 'chilled_water_pump', 'cooling_water_pump', 'cooling_tower', 'unknown')),
  equipment_name text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  rated_power_kw numeric,
  rated_cooling_capacity_kw numeric,
  rated_cop numeric,
  frequency_hz numeric,
  head_m numeric,
  flow_rate_m3h numeric,
  heat_exchange_capacity_kw numeric,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('unknown', 'running', 'standby', 'offline')),
  review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  confidence numeric,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_operation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  station_id uuid REFERENCES project_cooling_stations(id) ON DELETE SET NULL,
  source_file_id uuid REFERENCES project_survey_files(id) ON DELETE SET NULL,
  record_date date,
  record_time text NOT NULL DEFAULT '',
  shift text NOT NULL DEFAULT '',
  operating_status text NOT NULL DEFAULT '',
  operating_hours numeric,
  units_on_count integer,
  operating_current_pct numeric,
  load_rate_pct numeric CHECK (load_rate_pct IS NULL OR (load_rate_pct >= 0 AND load_rate_pct <= 100)),
  measured_energy_kwh numeric,
  notes text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_equipment_monthly_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  equipment_asset_id uuid NOT NULL REFERENCES project_hvac_equipment_assets(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  run_num integer NOT NULL DEFAULT 0,
  month_days integer NOT NULL,
  run_days integer NOT NULL DEFAULT 0,
  run_day_hours numeric NOT NULL DEFAULT 0,
  load_rate_pct numeric NOT NULL DEFAULT 0 CHECK (load_rate_pct >= 0 AND load_rate_pct <= 100),
  operation_strategy text NOT NULL DEFAULT 'partial_year'
    CHECK (operation_strategy IN ('full_year', 'partial_year')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipment_asset_id, year, month)
);

CREATE TABLE IF NOT EXISTS project_hvac_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  year integer NOT NULL,
  saving_mode text NOT NULL CHECK (saving_mode IN ('winter', 'balanced', 'summer', 'extreme')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hvac_saving_mode_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saving_mode text NOT NULL CHECK (saving_mode IN ('winter', 'balanced', 'summer', 'extreme')),
  device_type text NOT NULL CHECK (device_type IN ('chiller', 'chilled_water_pump', 'cooling_water_pump', 'cooling_tower')),
  avg_base numeric NOT NULL,
  rate1 numeric NOT NULL,
  rate2 numeric NOT NULL,
  rate3 numeric NOT NULL,
  rate4 numeric NOT NULL,
  rate5 numeric NOT NULL,
  rate6 numeric NOT NULL,
  rate7 numeric NOT NULL,
  rate8 numeric NOT NULL,
  rate9 numeric NOT NULL,
  rate10 numeric NOT NULL,
  rate11 numeric NOT NULL,
  rate12 numeric NOT NULL,
  UNIQUE (saving_mode, device_type)
);
```

Add indexes on `(project_id)`, `(project_id, station_id)`, `(project_id, extraction_status)`, and `(project_id, year)`.

**Step 3: Add RLS and triggers**

Use the same project style as `20260414020000_sprint22_survey_workspace.sql`: enable RLS and add authenticated policies. Add `updated_at` triggers for mutable tables.

**Step 4: Seed saving mode configs**

Insert default conservative placeholder configs for all 4 modes x 4 equipment types. Use `ON CONFLICT DO NOTHING`. The business owner can tune rates later without schema changes.

**Step 5: Run checks**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm run typecheck
npm test
```

Expected: existing API tests still pass.

**Step 6: Commit**

```bash
git add supabase/migrations/20260629090000_hvac_survey_workspace.sql api/src/modules/projects/project.schemas.ts api/test/projects.test.ts
git commit -m "feat: add hvac survey data model"
```

---

### Task 2: Add HVAC Calculation Core

**Files:**
- Create: `api/src/modules/projects/hvac-survey-calculator.ts`
- Create: `api/test/hvac-survey-calculator.test.ts`
- Modify: `api/src/modules/projects/project.schemas.ts`

**Step 1: Write failing tests**

Create `api/test/hvac-survey-calculator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeLoadRatePct, calculateHvacMonthlySaving } from '../src/modules/projects/hvac-survey-calculator.js';

describe('hvac survey calculator', () => {
  it('normalizes load rate to 0-100 percent units', () => {
    expect(normalizeLoadRatePct(0.75)).toBe(75);
    expect(normalizeLoadRatePct(75)).toBe(75);
    expect(normalizeLoadRatePct('75%')).toBe(75);
  });

  it('calculates monthly energy and savings from equipment profile', () => {
    const result = calculateHvacMonthlySaving({
      runNum: 2,
      ratedPowerKw: 30,
      runDays: 20,
      runDayHours: 10,
      loadRatePct: 75,
      savingRate: 0.12,
      electricityPricePerKwh: 0.8,
    });

    expect(result.energyBeforeKwh).toBe(9000);
    expect(result.energyAfterKwh).toBe(7920);
    expect(result.savingEnergyKwh).toBe(1080);
    expect(result.savingCostCny).toBe(864);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test -- hvac-survey-calculator
```

Expected: FAIL because the module does not exist.

**Step 3: Implement calculator**

Create pure functions:

```ts
export function normalizeLoadRatePct(value: unknown): number {
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/%$/, '');
    return normalizeLoadRatePct(Number(trimmed));
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('loadRatePct must be numeric');
  }
  const normalized = value > 0 && value <= 1 ? value * 100 : value;
  if (normalized < 0 || normalized > 100) {
    throw new Error('loadRatePct must be between 0 and 100');
  }
  return Math.round(normalized * 100) / 100;
}
```

Then implement:

```ts
energyBeforeKwh = runNum * ratedPowerKw * runDays * runDayHours * (loadRatePct / 100)
energyAfterKwh = energyBeforeKwh * (1 - savingRate)
savingEnergyKwh = energyBeforeKwh - energyAfterKwh
savingCostCny = savingEnergyKwh * electricityPricePerKwh
```

**Step 4: Add yearly aggregation**

Add `calculateHvacEvaluation()` that accepts equipment assets, monthly profiles, saving configs, and electricity price, then returns:

- `yearEnergyBeforeKwh`
- `yearEnergyAfterKwh`
- `yearSavingEnergyKwh`
- `yearSavingCostCny`
- `yearSavingRate`
- `byDeviceType`
- `monthTrends`

**Step 5: Run tests**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test -- hvac-survey-calculator
npm run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add api/src/modules/projects/hvac-survey-calculator.ts api/test/hvac-survey-calculator.test.ts api/src/modules/projects/project.schemas.ts
git commit -m "feat: add hvac monthly saving calculator"
```

---

### Task 3: Add Repository Methods And Completion Gate

**Files:**
- Modify: `api/src/modules/projects/project.schemas.ts`
- Modify: `api/src/modules/projects/project.repo.ts`
- Test: `api/test/projects.test.ts`

**Step 1: Extend schemas**

Add interfaces:

- `ProjectCoolingStation`
- `ProjectSurveyFile`
- `ProjectSurveyReviewItem`
- `ProjectHvacEquipmentAsset`
- `ProjectOperationRecord`
- `ProjectEquipmentMonthlyProfile`
- `ProjectHvacEvaluation`
- `ProjectHvacSurveyWorkspace`
- `ProjectHvacSurveyGateValidation`

Extend `ProjectRepo` with:

```ts
getProjectHvacSurveyWorkspace(projectId: string): Promise<ProjectHvacSurveyWorkspace | null>;
upsertCoolingStation(projectId: string, input: UpsertCoolingStationInput, actorUserId: string): Promise<ProjectHvacSurveyWorkspace | null>;
deleteCoolingStation(projectId: string, stationId: string, actorUserId: string): Promise<ProjectHvacSurveyWorkspace | null>;
upsertHvacEquipmentAssets(projectId: string, input: ProjectHvacEquipmentAsset[], actorUserId: string): Promise<ProjectHvacSurveyWorkspace | null>;
replaceMonthlyProfiles(projectId: string, input: ProjectEquipmentMonthlyProfile[], actorUserId: string): Promise<ProjectHvacSurveyWorkspace | null>;
runHvacEvaluation(projectId: string, input: RunHvacEvaluationInput, actorUserId: string): Promise<ProjectHvacSurveyWorkspace | null>;
```

**Step 2: Write gate tests**

Add tests that assert gate errors when:

- no cooling station exists
- no approved equipment exists
- an approved equipment asset is missing `deviceType`, `model`, or `ratedPowerKw`
- monthly profile does not contain 12 rows for each approved asset
- any `missing_info` gap remains open
- survey-to-proposal handoff is not `ready`, `completed`, or `waived`

**Step 3: Implement gate**

Add `buildHvacSurveyGateValidation()`:

```ts
const approvedAssets = equipmentAssets.filter((item) => item.reviewStatus === 'approved');
const assetsWithTwelveMonths = approvedAssets.every((asset) =>
  monthlyProfiles.filter((profile) => profile.equipmentAssetId === asset.id).length === 12
);
```

Gate must require:

- basic current survey info remains valid
- `stations.length > 0`
- `approvedAssets.length > 0`
- all approved assets have supported `deviceType !== 'unknown'`
- all approved assets have `ratedPowerKw > 0`
- all approved assets have 12 monthly profiles
- no open `missing_info` gaps
- ready/completed/waived survey-to-proposal handoff

**Step 4: Implement repository reads**

In `project.repo.ts`, query all HVAC survey tables in parallel and map snake_case rows into camelCase API schemas. Do not mutate existing `ProjectSurveyWorkspace`; add `ProjectHvacSurveyWorkspace` as an expanded workspace.

**Step 5: Run tests**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test -- projects
npm run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add api/src/modules/projects/project.schemas.ts api/src/modules/projects/project.repo.ts api/test/projects.test.ts
git commit -m "feat: add hvac survey workspace repo"
```

---

### Task 4: Add API Routes For Survey Submodules

**Files:**
- Modify: `api/src/routes/projects.ts`
- Test: `api/test/projects.test.ts`

**Step 1: Write route tests**

Add tests for:

- `GET /projects/:projectId/hvac-survey`
- `POST /projects/:projectId/hvac-survey/stations`
- `PATCH /projects/:projectId/hvac-survey/stations/:stationId`
- `DELETE /projects/:projectId/hvac-survey/stations/:stationId`
- `PUT /projects/:projectId/hvac-survey/equipment-assets`
- `PUT /projects/:projectId/hvac-survey/monthly-profiles`
- `POST /projects/:projectId/hvac-survey/evaluation/run`

Use the existing mocked `ProjectRepo` style in `api/test/projects.test.ts`.

**Step 2: Add request parsers**

Add parser helpers beside existing survey parsers:

```ts
function parseDeviceType(value: unknown): ProjectHvacDeviceType
function parseLoadRatePct(value: unknown): number
function parseSavingMode(value: unknown): ProjectHvacSavingMode
```

Reject invalid data with `AppError(400, ...)`.

**Step 3: Register routes**

Keep routes under `registerProjectRoutes()` so auth and audit behavior stays consistent. Route handlers must call repo methods only after parsing and validating input.

**Step 4: Audit events**

Ensure repo writes audit logs:

- `project.hvacSurvey.station.upserted`
- `project.hvacSurvey.station.deleted`
- `project.hvacSurvey.equipment.updated`
- `project.hvacSurvey.monthlyProfiles.replaced`
- `project.hvacSurvey.evaluation.run`

**Step 5: Run tests**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test -- projects
npm run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add api/src/routes/projects.ts api/test/projects.test.ts
git commit -m "feat: expose hvac survey api routes"
```

---

### Task 5: Add Safe File Collection And Extraction Workflow

**Files:**
- Modify: `api/package.json`
- Modify: `api/package-lock.json`
- Modify: `api/src/app.ts`
- Modify: `api/src/config/env.ts`
- Modify: `api/src/routes/projects.ts`
- Create: `api/src/modules/projects/hvac-survey-extraction.ts`
- Create: `api/test/hvac-survey-extraction.test.ts`
- Modify: `.env.example`

**Step 1: Add dependencies**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm install @fastify/multipart xlsx
```

**Step 2: Add environment fields**

Extend `AppEnv`:

```ts
surveyStorageBucket: string;
surveyAiProvider: 'disabled' | 'dashscope' | 'openai';
surveyAiApiKey: string | null;
```

Default `SURVEY_AI_PROVIDER` to `disabled`. This avoids Railway false health when no AI key exists.

**Step 3: Write extraction tests**

Create tests for:

- Excel/CSV device ledger extraction maps rows into equipment candidates.
- `unknown` is accepted only as incomplete and cannot pass gate.
- `loadRatePct` normalizes correctly.
- Image upload with AI disabled returns status `needs_review`, not `reviewed`.

**Step 4: Implement extraction adapter**

Implement:

```ts
export async function extractSurveyFile(input: ExtractSurveyFileInput): Promise<SurveyExtractionResult> {
  if (input.fileType === 'device_ledger' && isSpreadsheet(input.fileName)) {
    return extractDeviceLedgerSpreadsheet(input.buffer);
  }
  if (input.fileType === 'operation_record' && isSpreadsheet(input.fileName)) {
    return extractOperationRecordSpreadsheet(input.buffer);
  }
  return {
    status: 'needs_review',
    confidence: null,
    rawExtraction: { reason: 'manual_review_required' },
    candidates: [],
  };
}
```

Do not mark image files as automatically recognized unless a provider is configured and succeeds.

**Step 5: Add upload route**

Add:

```text
POST /projects/:projectId/hvac-survey/files
```

Multipart fields:

- `file`
- `stationId`
- `fileType`

Flow:

1. Validate project and station.
2. Upload file to Supabase Storage bucket.
3. Create `project_survey_files` row with `uploaded`.
4. Run extraction.
5. Update row to `needs_review` or `failed`.
6. Return refreshed workspace.

**Step 6: Add health signal**

Modify `api/src/routes/health.ts` so health includes:

```json
{
  "survey": {
    "storageBucket": "survey-files",
    "aiProvider": "disabled",
    "aiReady": false
  }
}
```

Do not fail health when AI is disabled; fail only if storage or Supabase is unavailable.

**Step 7: Run tests**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test
npm run typecheck
```

Expected: PASS.

**Step 8: Commit**

```bash
git add api/package.json api/package-lock.json api/src api/test .env.example
git commit -m "feat: add hvac survey file extraction workflow"
```

---

### Task 6: Add Review-To-Asset Workflow

**Files:**
- Modify: `api/src/modules/projects/project.schemas.ts`
- Modify: `api/src/modules/projects/project.repo.ts`
- Modify: `api/src/routes/projects.ts`
- Test: `api/test/projects.test.ts`

**Step 1: Write failing tests**

Add route tests for:

```text
GET /projects/:projectId/hvac-survey/review-items
PATCH /projects/:projectId/hvac-survey/review-items/:fileId
```

Test these cases:

- approving device ledger creates/updates equipment assets
- approving operation record creates operation records
- rejecting file sets `extraction_status = reviewed` and does not create assets
- invalid payload returns 400

**Step 2: Implement review route**

Request body:

```ts
{
  decision: 'approve' | 'reject',
  reviewedPayload: {
    equipmentAssets?: ProjectHvacEquipmentAsset[],
    operationRecords?: ProjectOperationRecord[]
  }
}
```

**Step 3: Enforce data integrity**

Approval must require:

- file belongs to project
- `device_type` in allowed enum
- `rated_power_kw > 0` for equipment assets
- `load_rate_pct` normalized before insert for operation records

**Step 4: Make writes transactional**

Prefer a Supabase RPC migration for review finalization:

```sql
CREATE OR REPLACE FUNCTION approve_hvac_survey_file(...)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- update file, delete stale pending assets from this source file, insert reviewed assets/records
END;
$$;
```

If RPC is deferred, repository must at least validate all rows before any delete/insert. Do not delete old data before validation.

**Step 5: Run tests**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test -- projects
npm run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add api/src/modules/projects api/src/routes/projects.ts api/test/projects.test.ts supabase/migrations
git commit -m "feat: add hvac survey review workflow"
```

---

### Task 7: Add Safe Monthly Profile Import

**Files:**
- Modify: `api/src/modules/projects/hvac-survey-extraction.ts`
- Modify: `api/src/modules/projects/project.repo.ts`
- Modify: `api/src/routes/projects.ts`
- Test: `api/test/hvac-survey-extraction.test.ts`
- Test: `api/test/projects.test.ts`

**Step 1: Write failing tests**

Test that:

- 12 rows per equipment pass.
- 11 rows fail with a clear validation error.
- invalid load rate fails before any replace.
- import with one bad row leaves existing monthly rows untouched.

**Step 2: Implement parser**

Expected columns:

- `equipmentName`
- `deviceType`
- `ratedPowerKw`
- `year`
- `month`
- `runNum`
- `runDays`
- `runDayHours`
- `loadRatePct`

Support Chinese aliases:

- `设备名称`
- `设备类型`
- `额定功率`
- `年份`
- `月份`
- `开启台数`
- `月运行天数`
- `平均日运行小时数`
- `负荷率`

**Step 3: Implement replace through RPC**

Create migration function:

```sql
CREATE OR REPLACE FUNCTION replace_project_equipment_monthly_profiles(
  p_project_id uuid,
  p_profiles jsonb
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM project_equipment_monthly_profiles
  WHERE project_id = p_project_id
    AND equipment_asset_id IN (
      SELECT DISTINCT (item->>'equipmentAssetId')::uuid
      FROM jsonb_array_elements(p_profiles) item
    );

  INSERT INTO project_equipment_monthly_profiles (...)
  SELECT ...
  FROM jsonb_array_elements(p_profiles) item;
END;
$$;
```

The API must validate all rows before calling this RPC.

**Step 4: Run tests**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add api/src/modules/projects api/src/routes/projects.ts api/test supabase/migrations
git commit -m "feat: add safe hvac monthly profile import"
```

---

### Task 8: Add Frontend API Client And State Utilities

**Files:**
- Modify: `src/api/projects.ts`
- Create: `src/utils/hvacSurveyWorkspace.ts`
- Create: `src/utils/hvacSurveyWorkspace.test.ts`
- Modify: `src/utils/projectSolutionWorkspace.ts`
- Modify: `src/utils/projectSolutionWorkspace.test.ts`

**Step 1: Write frontend utility tests**

Create tests for:

- default workspace shape
- tab completion counters
- load rate normalization for draft rows
- gate message mapping to Chinese UI copy
- evaluation summary formatting

**Step 2: Add types and serializers**

Create `src/utils/hvacSurveyWorkspace.ts` with:

- `ProjectHvacSurveyWorkspace`
- `CoolingStationDraft`
- `EquipmentAssetDraft`
- `MonthlyProfileDraft`
- `serializeEquipmentAssetsDraft`
- `serializeMonthlyProfilesDraft`
- `formatHvacGateError`

**Step 3: Extend client**

Add API functions:

```ts
export async function getProjectHvacSurveyWorkspace(projectId: string)
export async function upsertCoolingStation(projectId: string, payload: CoolingStationPayload)
export async function deleteCoolingStation(projectId: string, stationId: string)
export async function uploadSurveyFile(projectId: string, payload: FormData)
export async function reviewSurveyFile(projectId: string, fileId: string, payload: ReviewPayload)
export async function updateHvacEquipmentAssets(projectId: string, payload: EquipmentAssetPayload[])
export async function replaceMonthlyProfiles(projectId: string, payload: MonthlyProfilePayload[])
export async function runHvacEvaluation(projectId: string, payload: RunEvaluationPayload)
```

**Step 4: Run tests**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo
npm run typecheck
node --test src/utils/hvacSurveyWorkspace.test.ts src/utils/projectSolutionWorkspace.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/api/projects.ts src/utils/hvacSurveyWorkspace.ts src/utils/hvacSurveyWorkspace.test.ts src/utils/projectSolutionWorkspace.ts src/utils/projectSolutionWorkspace.test.ts
git commit -m "feat: add hvac survey frontend model"
```

---

### Task 9: Build Survey Workbench UI

**Files:**
- Create: `src/components/projects/survey/HvacSurveyWorkspace.tsx`
- Create: `src/components/projects/survey/SurveyOverviewTab.tsx`
- Create: `src/components/projects/survey/CoolingStationsTab.tsx`
- Create: `src/components/projects/survey/SurveyFilesTab.tsx`
- Create: `src/components/projects/survey/SurveyReviewTab.tsx`
- Create: `src/components/projects/survey/EquipmentAssetsTab.tsx`
- Create: `src/components/projects/survey/MonthlyProfilesTab.tsx`
- Create: `src/components/projects/survey/HvacEvaluationTab.tsx`
- Create: `src/components/projects/survey/SurveyHandoffTab.tsx`
- Modify: `src/pages/projects/ProjectDetailPage.tsx`

**Step 1: Extract current survey block**

Move the existing Survey Workspace block out of `ProjectDetailPage.tsx` into `HvacSurveyWorkspace.tsx`. Keep current behavior passing before adding new tabs.

**Step 2: Add tabs**

Use local segmented buttons or tabs. Required labels:

- `概览`
- `冷冻站`
- `资料收资`
- `识别审核`
- `设备台账`
- `运行建模`
- `节能测算`
- `缺口与交接`

Do not create a landing page or marketing copy. The first viewport must be the usable workbench.

**Step 3: Implement each tab**

- Overview: gate status, station count, approved equipment count, monthly profile completeness, latest evaluation summary.
- Cooling stations: create/edit/delete station.
- Survey files: upload file with station and file type, show status.
- Review: side list of files needing review; detail editor for equipment/operation rows; approve/reject.
- Equipment assets: editable table with equipment-type-specific fields.
- Monthly profiles: 12-month grid by equipment, import/export buttons, inline validation.
- Evaluation: saving mode selector and result cards/chart.
- Handoff: reuse existing data gaps and handoffs, but gate should use HVAC rules.

**Step 4: Keep UI robust**

- Empty states must offer the next action.
- AI disabled state must say manual review is required, not "识别成功".
- Buttons must be disabled while saving.
- Long text must not overflow table cells on mobile.

**Step 5: Run frontend checks**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/components/projects/survey src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat: add hvac survey workbench ui"
```

---

### Task 10: Connect Survey Output To Solution Center

**Files:**
- Modify: `api/src/modules/projects/solution-calculator.ts`
- Modify: `api/src/modules/projects/project.schemas.ts`
- Modify: `api/src/modules/projects/project.repo.ts`
- Modify: `src/utils/projectSolutionWorkspace.ts`
- Modify: `src/pages/projects/ProjectDetailPage.tsx`
- Test: `api/test/solution-calculator.test.ts`
- Test: `src/utils/projectSolutionWorkspace.test.ts`

**Step 1: Add calculation mode**

Add:

```ts
type ProjectSolutionCalculationMode = 'quick_estimate' | 'equipment_monthly';
```

**Step 2: Write tests**

Test:

- uses `equipment_monthly` when HVAC evaluation result exists
- falls back to `quick_estimate` when no approved monthly model exists
- solution gate warns when survey gate is incomplete

**Step 3: Implement bridge**

When building solution workspace:

- read latest `project_hvac_evaluations`
- map its result to `ProjectSolutionCalculationSummary`
- include `calculationMode`
- preserve existing RT/COP fields for fallback

**Step 4: Update frontend**

Solution Center should show:

- `测算模式：设备月度模型` when data comes from Survey
- `测算模式：快速估算` when using current assumptions
- warning if Survey has open gate errors

**Step 5: Run checks**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test -- solution-calculator projects
npm run typecheck
cd /Users/pete/Project/CoolingTowerScan/repo
npm run typecheck
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add api/src/modules/projects api/test src/utils src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat: use hvac survey model in solution center"
```

---

### Task 11: Railway And Supabase Deployment Readiness

**Files:**
- Modify: `.env.example`
- Modify: `api/src/routes/health.ts`
- Modify: `README.md`
- Optional Modify: `railway.toml`
- Optional Modify: `api/railway.toml`

**Step 1: Document required env vars**

Add to `.env.example`:

```env
# API base URL for frontend
VITE_API_BASE_URL=

# API service
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SURVEY_STORAGE_BUCKET=survey-files
SURVEY_AI_PROVIDER=disabled
SURVEY_AI_API_KEY=
```

**Step 2: Add Railway release checklist to README**

Document:

1. Apply Supabase migrations.
2. Create Supabase Storage bucket `survey-files`.
3. Set API Railway env vars.
4. Set frontend Railway env vars.
5. Deploy API service.
6. Deploy frontend service.
7. Smoke test `/health`.
8. Smoke test project detail -> 探勘调研.

**Step 3: Health contract**

`GET /health` should return:

```json
{
  "ok": true,
  "services": {
    "supabase": "ok",
    "surveyStorage": "ok",
    "surveyAi": "disabled"
  }
}
```

If storage bucket is missing, health should be non-ok so Railway does not accept a broken deploy.

**Step 4: Run deployment checks locally**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm run build
npm test
cd /Users/pete/Project/CoolingTowerScan/repo
npm run build
npm run lint
```

Expected: PASS.

**Step 5: Commit**

```bash
git add .env.example README.md api/src/routes/health.ts railway.toml api/railway.toml
git commit -m "chore: document hvac survey railway deployment"
```

---

### Task 12: End-To-End QA And Bug Gates

**Files:**
- Create: `docs/qa/hvac-survey-railway-smoke.md`

**Step 1: Write smoke script**

Document this exact manual scenario:

1. Open Railway frontend URL.
2. Login if auth is enabled.
3. Open any project.
4. Enter `探勘调研`.
5. Create `1# 冷冻站`.
6. Upload a device ledger CSV with one `cooling_tower`.
7. Confirm file appears in `识别审核`.
8. Approve reviewed equipment.
9. Confirm equipment appears in `设备台账`.
10. Enter 12 monthly profile rows.
11. Choose `balanced` saving mode.
12. Run calculation.
13. Confirm annual saving result is non-zero.
14. Mark survey-to-proposal handoff ready.
15. Complete Survey.
16. Open Solution Center and confirm calculation mode is `设备月度模型`.

**Step 2: Add regression checklist**

Checklist must include:

- no delete-before-validate import
- no `unknow` value anywhere
- `loadRatePct` stored as 0-100
- AI disabled does not claim success
- health fails if storage bucket is absent
- mobile layout has no overlapping controls
- existing detection and project routes still work

**Step 3: Run final command suite**

Run:

```bash
cd /Users/pete/Project/CoolingTowerScan/repo/api
npm test
npm run typecheck
cd /Users/pete/Project/CoolingTowerScan/repo
npm run lint
npm run typecheck
npm run build
```

Expected: PASS.

**Step 4: Deploy to Railway**

Use the existing Railway project/service setup:

```bash
railway up --service <api-service-name>
railway up --service <frontend-service-name>
```

Then verify:

```bash
curl https://<api-service-domain>/health
```

Expected: `ok: true`, `surveyStorage: ok`, `surveyAi: disabled` or configured provider ok.

**Step 5: Create PR**

```bash
git push origin <branch-name>
gh pr create --title "feat: integrate hvac survey workflow" --body-file docs/qa/hvac-survey-railway-smoke.md
```

**Step 6: Commit QA doc**

```bash
git add docs/qa/hvac-survey-railway-smoke.md
git commit -m "docs: add hvac survey railway smoke checklist"
```

---

## Implementation Order

Use this order exactly:

1. Schema and pure calculation.
2. Repository and API read/write contracts.
3. Safe file/import/review workflow.
4. Frontend model and API client.
5. Workbench UI.
6. Solution Center bridge.
7. Railway health/deployment.
8. End-to-end smoke and PR.

Do not build UI before backend contracts are tested. Do not deploy before the import/review workflow has tests proving failed imports do not delete existing data.

## Non-Negotiable Bug Gates

- No `as never` or type suppression for business payloads.
- No broad delete before successful parse and validation.
- No hidden AI dependency that makes Railway appear healthy while extraction is unusable.
- No `unknown` equipment can complete Survey.
- No monthly profile with fewer than 12 months can complete Survey.
- No `loadRatePct` outside `0..100`.
- No Survey completion when required handoff is missing.
- No Solution snapshot using stale quick estimate when a current HVAC evaluation exists.

## Expected User-Visible Result After Railway Deploy

In the current system, the user opens a project and sees the upgraded `探勘调研` workspace. They can create cold stations, upload files, review extracted data, maintain HVAC equipment assets, model monthly operation, run saving calculation, close data gaps, prepare the handoff package, complete the Survey stage, and then see the same calculation available in Solution Center. This is the complete business loop.
