# Sprint 3.1 Solution Center Design

> **Context:** Wave 3 Sprint 3.1 for the pre-contract HVAC platform.

**Goal:** Add the first governed solution workspace on top of the existing project command page, so proposal-stage technical assumptions, savings estimates, and version snapshots become server-owned workflow assets.

**Recommended Approach:** Keep the editable solution draft inside `projects.phase_data.proposal.solutionWorkspace` and add a dedicated `project_solution_snapshots` table for immutable version records. This keeps the draft model aligned with the existing survey pattern, while introducing real version history without over-building a new aggregate root too early.

## Options Considered

### Option A: Draft in `phase_data`, snapshots in dedicated table

**Pros**
- Reuses the current project aggregate and stage-centric write pattern
- Smallest schema change that still creates formal versions
- Frontend can stay inside `ProjectDetailPage`

**Cons**
- `phase_data` continues carrying more structured JSON
- Later commercial branching may still need a dedicated solution root

### Option B: Dedicated `project_solutions` table plus snapshots

**Pros**
- Cleaner long-term domain boundary
- Easier to branch EPC and EMC later

**Cons**
- More repo/service surface area now
- Higher migration cost before the commercial branch actually exists

### Option C: Frontend-only draft with export-time calculation

**Pros**
- Fastest to demo

**Cons**
- Violates the platform direction
- No governed versions, weak auditability, and no server-owned gate

**Decision:** Option A.

## Scope

### In Scope
- Solution draft object
- Technical assumptions form
- Savings estimate calculation service in `api`
- Version snapshot creation and listing
- Proposal-stage gate validation for snapshot readiness
- Project detail page `Solution Center` section

### Out Of Scope
- EPC / EMC branch-specific pricing
- Full HVAC engineering calculation engine
- Document export and approval freeze
- Multi-solution compare view

## Data Model

### Draft

Store under `projects.phase_data.proposal.solutionWorkspace`:

- `summary`
  - `solutionName`
  - `strategySummary`
  - `retrofitScope`
  - `baselineSource`
- `technicalAssumptions`
  - `baselineLoadRt`
  - `targetLoadRt`
  - `operatingHoursPerYear`
  - `electricityPricePerKwh`
  - `baselineCop`
  - `targetCop`
  - `systemLossFactor`
- `savingsEstimate`
  - calculated metrics from the API service
- `gateValidation`
  - `canSnapshot`
  - `errors`
- `snapshotStatus`
  - `draft` or `versioned`
- `latestSnapshotVersion`

### Snapshots

New table: `project_solution_snapshots`

- `id`
- `project_id`
- `version_no`
- `stage_code`
- `solution_name`
- `summary`
- `technical_assumptions`
- `savings_estimate`
- `created_by`
- `created_at`

## API Surface

- `GET /v1/projects/:projectId/solution-workspace`
- `PATCH /v1/projects/:projectId/solution-workspace`
- `GET /v1/projects/:projectId/solution-snapshots`
- `POST /v1/projects/:projectId/solution-snapshots`

## Calculation Model

Use a lightweight API-owned calculator:

- baseline annual kWh = `(baselineLoadRt * 3.517 / baselineCop) * operatingHoursPerYear * systemLossFactor`
- target annual kWh = `(targetLoadRt * 3.517 / targetCop) * operatingHoursPerYear * systemLossFactor`
- annual power saving = `baseline annual kWh - target annual kWh`
- annual cost saving = `annual power saving * electricityPricePerKwh`
- efficiency improvement ratio = `1 - target annual kWh / baseline annual kWh`

The initial draft can prefill `baselineLoadRt` from existing upstream evidence in this order:

1. survey equipment ledger total `capacityRt`
2. lead/candidate HVAC estimate snapshot typical capacity
3. empty value

## UI

Add a `Solution Center` section to `src/pages/projects/ProjectDetailPage.tsx`:

- summary form
- technical assumptions form
- read-only calculation cards
- snapshot gate status
- snapshot history list
- save draft and create snapshot actions

## Validation Rules

Draft can save with partial content.

Snapshot creation requires:

- `solutionName`
- `strategySummary`
- `baselineLoadRt > 0`
- `targetLoadRt > 0`
- `operatingHoursPerYear > 0`
- `electricityPricePerKwh > 0`
- `baselineCop > 0`
- `targetCop > 0`
- `baseline annual kWh > target annual kWh`

## Testing

- calculator unit tests in `api`
- route/service tests for workspace read/write and snapshot creation
- frontend mapper/helper tests
- web `typecheck` and `build`
- api `typecheck`, `build`, and `test`
