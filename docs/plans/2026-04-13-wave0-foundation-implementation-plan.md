# Wave 0 Foundation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the minimum technical backbone that turns CoolingTowerScan from a front-end driven scan tool into a Railway-deployed pre-contract platform foundation with API-owned workflow writes.

**Architecture:** Keep the current repo root as the `web` app, keep `detection/` as the existing FastAPI inference service, and add a new `api/` Node service as the workflow authority. Do not do a full monorepo migration in Wave 0. Introduce the smallest structure that supports governed business objects: `scan_candidate -> lead -> project`.

**Tech Stack:** React, TypeScript, Vite, React Router, Supabase Postgres/Auth/Storage, Fastify, Zod, FastAPI, Railway, GitHub Actions

---

## 1. Current State Snapshot

### What exists now

- `web` is the repo root and talks directly to Supabase with `anon` credentials through [`src/lib/supabase.ts`](/Users/pete/Project/CoolingTowerScan/repo/src/lib/supabase.ts).
- Discovery flow already exists:
  - `scan_sessions`
  - `scan_screenshots`
  - `detection_results`
  - `enterprises`
- A lightweight lifecycle prototype already exists:
  - [`src/types/project.ts`](/Users/pete/Project/CoolingTowerScan/repo/src/types/project.ts)
  - [`src/hooks/useProjects.ts`](/Users/pete/Project/CoolingTowerScan/repo/src/hooks/useProjects.ts)
  - [`src/components/ProjectDashboard.tsx`](/Users/pete/Project/CoolingTowerScan/repo/src/components/ProjectDashboard.tsx)
  - [`src/components/LifecycleSidebar.tsx`](/Users/pete/Project/CoolingTowerScan/repo/src/components/LifecycleSidebar.tsx)
  - [`supabase/migrations/20260408150517_create_project_lifecycle_tables.sql`](/Users/pete/Project/CoolingTowerScan/repo/supabase/migrations/20260408150517_create_project_lifecycle_tables.sql)
- `detection/` is already an independent FastAPI service with model weight `weights/best.pt`.
- CI currently validates only `web` and `detection`; there is no `api` service in CI.

### What is missing

- No business API exists yet.
- No route-based information architecture exists in `web`; the app is still a single-shell state machine.
- No formal `site`, `scan_candidate`, or `lead` model exists.
- Current workflow writes are still front-end direct database writes.
- Current RLS posture is too open for an internal-only operating platform:
  - `scan_sessions` and `scan_screenshots` currently allow all operations.
  - `enterprises` still has historical anonymous write policies from the discovery phase.
- The existing `projects.phase_data` JSONB prototype is useful as a UI seed, but it is not a sufficient authoritative workflow model.

### Wave 0 objective boundary

Wave 0 is successful when the platform can do the following without front-end direct business writes:

1. Persist a governed `scan_candidate` from existing scan evidence.
2. Convert an approved candidate into a `lead`.
3. Convert a qualified lead into a `project`.
4. Deploy `web`, `api`, and `detection` independently on Railway.

Wave 0 is not the time to build survey forms, calculation engines, bidding, or contract generation.

---

## 2. Target Topology For Wave 0

### Railway services

- `web`
  - current Vite front-end
  - public/internal UI entry
  - uses `VITE_API_BASE_URL` and `VITE_DETECTION_API_URL`
- `api`
  - new Fastify service
  - authoritative owner of candidate, lead, and project writes
  - owns audit logging and gate validation
- `detection`
  - existing FastAPI inference service
  - remains focused on image detection and stitched-image processing

### Service responsibilities

`web`
- Render discovery pages and operating pages.
- Stop writing core workflow objects directly to Supabase.
- Keep non-sensitive read queries on Supabase temporarily where needed in Sprint 0.1.

`api`
- Own write-side business rules.
- Verify authenticated user context.
- Use Supabase service role on the server only.
- Expose stable DTOs for candidate, lead, and project lifecycle actions.

`detection`
- Stay isolated from commercial workflow rules.
- Continue to return raw detection outputs plus minimal metadata.

`supabase`
- Remains system of record for structured business data and assets.
- RLS remains enabled, but write access gradually moves behind `api`.

---

## 3. Data Model Decisions For Wave 0

## 3.1 Keep, modify, or defer

### Keep in place

- `enterprises`
- `scan_sessions`
- `scan_screenshots`
- `detection_results`
- `projects`
- `project_documents`
- `agent_tasks` as non-authoritative experimental/auxiliary data

### Modify in Wave 0

- `projects`
  - add `site_id`
  - add `lead_id`
  - add `project_code`
  - keep `current_phase` temporarily for compatibility
  - treat `phase_data` as transitional UI cache, not gate authority
- `scan_screenshots`
  - keep evidence role
  - do not overload it with lead/project semantics

### New tables to add

- `sites`
- `scan_candidates`
- `scan_candidate_evidences`
- `leads`
- `lead_confirmations`
- `project_stage_states`
- `workflow_audit_logs`

## 3.2 Exact schema additions

### `sites`

Purpose: separate enterprise master data from project carrier data.

Suggested columns:

- `id uuid primary key`
- `enterprise_id uuid not null references enterprises(id)`
- `site_name text not null`
- `site_code text`
- `address text not null`
- `normalized_address text not null default ''`
- `province text not null default ''`
- `city text not null default ''`
- `district text not null default ''`
- `longitude_gcj02 double precision`
- `latitude_gcj02 double precision`
- `coordinate_status text not null default 'pending'`
- `coordinate_source text not null default 'amap'`
- `source_scan_session_id uuid null references scan_sessions(id)`
- `source_screenshot_id uuid null references scan_screenshots(id)`
- `is_primary boolean not null default true`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `(enterprise_id)`
- `(normalized_address)`
- `(city, district)`

Notes:

- If the same enterprise later has multiple campuses or plants, `site` becomes the stable project carrier.
- GCJ-02 should be the platform coordinate convention if AMap remains the base map.

### `scan_candidates`

Purpose: formal review layer between raw scan output and formal lead.

Suggested columns:

- `id uuid primary key`
- `candidate_code text not null unique`
- `scan_session_id uuid references scan_sessions(id)`
- `enterprise_id uuid null references enterprises(id)`
- `site_id uuid null references sites(id)`
- `status text not null check (status in ('new','under_review','approved','rejected','needs_info','converted'))`
- `source_type text not null default 'cooling_tower_scan'`
- `source_label text not null default ''`
- `matched_enterprise_name text not null default ''`
- `matched_address text not null default ''`
- `cooling_tower_count integer not null default 0`
- `total_tower_area_m2 double precision not null default 0`
- `total_tower_bbox_area_px double precision not null default 0`
- `estimated_capacity_rt double precision not null default 0`
- `estimated_cooling_station_power_kw double precision not null default 0`
- `confidence_score double precision not null default 0`
- `review_note text not null default ''`
- `rejection_reason text not null default ''`
- `source_payload jsonb not null default '{}'::jsonb`
- `hvac_estimate_snapshot jsonb not null default '{}'::jsonb`
- `created_by uuid null`
- `reviewed_by uuid null`
- `reviewed_at timestamptz`
- `converted_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `(status, created_at desc)`
- `(enterprise_id)`
- `(site_id)`
- `(scan_session_id)`

### `scan_candidate_evidences`

Purpose: keep candidate-to-evidence mapping normalized.

Suggested columns:

- `id uuid primary key`
- `candidate_id uuid not null references scan_candidates(id) on delete cascade`
- `screenshot_id uuid null references scan_screenshots(id) on delete cascade`
- `detection_result_id uuid null references detection_results(id) on delete cascade`
- `kind text not null check (kind in ('original','annotated','bbox','session_cover'))`
- `sort_order integer not null default 0`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Unique rules:

- `unique(candidate_id, screenshot_id, detection_result_id, kind)`

### `leads`

Purpose: formal mixed commercial + technical qualification object.

Suggested columns:

- `id uuid primary key`
- `lead_code text not null unique`
- `candidate_id uuid not null unique references scan_candidates(id)`
- `enterprise_id uuid not null references enterprises(id)`
- `site_id uuid not null references sites(id)`
- `name text not null`
- `status text not null check (status in ('new','pending_confirmation','qualified','disqualified','on_hold','converted'))`
- `sales_owner_user_id uuid null`
- `technical_owner_user_id uuid null`
- `priority text not null default 'medium' check (priority in ('high','medium','low'))`
- `next_action text not null default ''`
- `risk_summary text not null default ''`
- `qualification_summary jsonb not null default '{}'::jsonb`
- `source_snapshot jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `lead_confirmations`

Purpose: enforce dual confirmation before project creation.

Suggested columns:

- `id uuid primary key`
- `lead_id uuid not null references leads(id) on delete cascade`
- `confirmation_role text not null check (confirmation_role in ('sales','technical'))`
- `status text not null check (status in ('pending','confirmed','rejected'))`
- `comment text not null default ''`
- `confirmed_by uuid null`
- `confirmed_at timestamptz`
- `created_at timestamptz not null default now()`

Unique rules:

- `unique(lead_id, confirmation_role)`

### `project_stage_states`

Purpose: replace free-form project status drift with one row per stage.

Suggested columns:

- `id uuid primary key`
- `project_id uuid not null references projects(id) on delete cascade`
- `stage_code text not null`
- `status text not null check (status in ('not_started','in_progress','blocked','pending_approval','completed','waived'))`
- `owner_user_id uuid null`
- `approver_user_id uuid null`
- `entered_at timestamptz`
- `due_at timestamptz`
- `completed_at timestamptz`
- `blockers jsonb not null default '[]'::jsonb`
- `gate_snapshot jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Unique rules:

- `unique(project_id, stage_code)`

### `workflow_audit_logs`

Purpose: append-only audit trail for all gated business actions.

Suggested columns:

- `id uuid primary key`
- `entity_type text not null`
- `entity_id uuid not null`
- `action text not null`
- `actor_user_id uuid null`
- `actor_source text not null default 'api'`
- `payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Indexes:

- `(entity_type, entity_id, created_at desc)`
- `(action, created_at desc)`

## 3.3 Modify existing `projects`

Create one migration to extend the current prototype instead of replacing it.

Add columns:

- `site_id uuid null references sites(id)`
- `lead_id uuid null references leads(id)`
- `project_code text unique`
- `workflow_status text not null default 'active'`

Rules:

- keep `current_phase` for compatibility with existing UI
- initialize `project_stage_states` on project creation
- stop treating `phase_data` as the source of truth for gates

## 3.4 RLS hardening target

By the end of Sprint 0.2:

- browser `anon` writes to `enterprises`, `scan_sessions`, `scan_screenshots`, `detection_results`, `projects` should be removed or reduced to the narrowest compatible path
- all candidate, lead, and project creation flows should go through `api`
- `api` uses service role and writes explicit audit rows

---

## 4. API Design For Wave 0

## 4.1 Folder layout

Create a new `api/` service with this minimum structure:

```text
api/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    app.ts
    config/env.ts
    plugins/
      supabase.ts
      auth.ts
      audit.ts
      errors.ts
    routes/
      health.ts
      candidates.ts
      leads.ts
      projects.ts
    modules/
      candidates/
        candidate.schemas.ts
        candidate.service.ts
        candidate.repo.ts
      leads/
        lead.schemas.ts
        lead.service.ts
        lead.repo.ts
      projects/
        project.schemas.ts
        project.service.ts
        project.repo.ts
      workflow/
        audit.repo.ts
        stage-state.service.ts
    lib/
      codes.ts
      stage-enums.ts
      result.ts
  test/
    health.test.ts
    candidates.test.ts
    leads.test.ts
    projects.test.ts
```

## 4.2 Route groups

### `GET /health`

Purpose:

- Railway health check
- return service version, environment, and Supabase connectivity summary

### `GET /v1/bootstrap`

Purpose:

- front-end bootstrap metadata
- current user identity
- service URLs
- stage enum dictionary

### `GET /v1/candidates`

Capabilities:

- status filters
- search by enterprise/site/address
- pagination
- summary counters

### `GET /v1/candidates/:candidateId`

Capabilities:

- candidate core data
- evidence list
- related enterprise/site summary
- HVAC estimate snapshot

### `POST /v1/candidates/from-scan-session/:sessionId`

Purpose:

- materialize governed candidates from raw `scan_sessions`, `scan_screenshots`, and `detection_results`

Rules:

- idempotent by `sessionId` + evidence set
- create one candidate per matched enterprise/site bundle, not per bounding box

### `POST /v1/candidates/:candidateId/review`

Body:

- `action`: `approve | reject | needs_info | reopen`
- `note`

Rules:

- writes audit log
- on approve, candidate may remain `approved` without auto-creating a lead

### `POST /v1/leads`

Purpose:

- create lead from approved candidate

Rules:

- candidate must be `approved`
- candidate must have bound `enterprise_id` and `site_id`
- create both `lead` row and two `lead_confirmations` rows

### `POST /v1/leads/:leadId/confirm`

Body:

- `role`: `sales | technical`
- `action`: `confirm | reject`
- `comment`

Rules:

- both confirmations must be `confirmed` before project bootstrap is allowed

### `POST /v1/projects`

Purpose:

- create project from qualified lead

Rules:

- both lead confirmations must be confirmed
- project code generated by server
- create initial `project_stage_states`
- write audit log and mark lead as `converted`

### `GET /v1/projects`

Capabilities:

- list with summary fields for dashboard
- do not leak raw `phase_data`
- join current stage state summary

### `GET /v1/projects/:projectId`

Capabilities:

- project shell
- stage state timeline
- lead and enterprise summary

## 4.3 DTO and error policy

- All request bodies validated by Zod.
- Common error envelope:

```json
{
  "error": {
    "code": "LEAD_NOT_QUALIFIED",
    "message": "Lead requires both sales and technical confirmation.",
    "details": {}
  }
}
```

- Audit every mutation route.
- Idempotency required for:
  - candidate generation from session
  - lead creation from candidate
  - project creation from lead

---

## 5. Front-End Migration Plan For Wave 0

## 5.1 Route map

Introduce `react-router-dom` in Sprint 0.1.

### Wave 0 route tree

- `/`
  - redirect to `/discovery/detection`
- `/discovery/screenshot`
- `/discovery/detection`
- `/discovery/results`
- `/candidates`
- `/candidates/:candidateId`
- `/leads`
- `/leads/:leadId`
- `/projects`
- `/projects/:projectId`

### Suggested file layout

```text
src/
  app/
    router.tsx
    layouts/AppShell.tsx
  pages/
    discovery/
      ScreenshotPage.tsx
      DetectionPage.tsx
      ResultsPage.tsx
    candidates/
      CandidateListPage.tsx
      CandidateDetailPage.tsx
    leads/
      LeadListPage.tsx
      LeadDetailPage.tsx
    projects/
      ProjectListPage.tsx
      ProjectDetailPage.tsx
  api/
    client.ts
    candidates.ts
    leads.ts
    projects.ts
```

## 5.2 Existing components to preserve and adapt

Do not rewrite the UI from zero in Wave 0. Reuse current components where possible.

Primary adaptation targets:

- [`src/components/LifecycleSidebar.tsx`](/Users/pete/Project/CoolingTowerScan/repo/src/components/LifecycleSidebar.tsx)
  - convert from local state navigation to router-aware navigation
- [`src/components/ProjectDashboard.tsx`](/Users/pete/Project/CoolingTowerScan/repo/src/components/ProjectDashboard.tsx)
  - rebind data source to API-backed project summaries
- [`src/hooks/useProjects.ts`](/Users/pete/Project/CoolingTowerScan/repo/src/hooks/useProjects.ts)
  - stop using direct Supabase writes for `createFromEnterprise`
  - replace with `api/projects.create`
- [`src/App.tsx`](/Users/pete/Project/CoolingTowerScan/repo/src/App.tsx)
  - reduce to app bootstrap + router mount

## 5.3 Read/write migration policy

### Sprint 0.1

- keep existing discovery reads on Supabase where it speeds delivery
- add router and API client
- move only new candidate/lead/project actions to `api`

### Sprint 0.2

- move project dashboard reads to `api`
- keep low-risk discovery-only reads on Supabase if they are pure read models
- no browser-side service-role logic ever

## 5.4 Candidate and lead UI scope

Wave 0 UI is intentionally thin:

- Candidate list page
  - status tabs
  - filters
  - counts
  - quick actions
- Candidate detail page
  - evidence gallery
  - matched enterprise/site
  - HVAC estimate snapshot
  - review action buttons
- Lead list page
  - dual confirmation status
  - owner, priority, next action
- Lead detail page
  - sales confirmation
  - technical confirmation
  - convert-to-project button

---

## 6. Railway, Environment, And CI Plan

## 6.1 Railway services

### `web`

Root:

- repo root

Required env:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`
- `VITE_DETECTION_API_URL`
- `VITE_AMAP_API_KEY`

Build/start:

- `npm ci`
- `npm run build`
- Railway static/Nixpacks existing web flow

### `api`

Root:

- `api/`

Required env:

- `PORT`
- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `APP_ORIGIN`
- `DETECTION_API_URL`
- `AMAP_API_KEY`

Build/start:

- `npm ci`
- `npm run build`
- `npm run start`

### `detection`

Root:

- `detection/`

Required env:

- `PORT`
- `MODEL_PATH`
- `CORS_ALLOW_ORIGINS`

Build/start:

- keep current FastAPI startup flow

## 6.2 CI changes

Modify [`.github/workflows/ci.yml`](/Users/pete/Project/CoolingTowerScan/repo/.github/workflows/ci.yml) to add:

- `api` install + typecheck + tests + build
- optional shared migration lint/check step

Target jobs:

- `frontend`
- `api`
- `detection`

## 6.3 Environment documentation

Create:

- `docs/platform/env-matrix.md`

Document:

- local env file names
- which secrets belong only on server
- Railway service-to-env mapping

---

## 7. Migration Strategy From Direct Supabase Writes To API-Owned Writes

## Phase A: Add API without breaking web

- Add `api/` and deploy it independently.
- Keep current discovery flow working.
- Introduce API client in web.

## Phase B: Move business writes first

Move these actions behind `api` in this order:

1. candidate materialization from scan session
2. candidate review
3. lead creation
4. dual confirmation
5. project creation

Rationale:

- write paths are where workflow authority matters most
- pure reads can lag one sprint behind without corrupting state

## Phase C: Harden RLS after cutover

- remove anonymous write policies that were acceptable for the original discovery prototype
- require authenticated identity for operating actions
- ensure `web` cannot create projects directly through Supabase anymore

## Phase D: Retire transitional direct project hooks

- deprecate `create_project_from_enterprise` RPC as the primary creation path
- keep it only if needed for legacy imports, otherwise remove in a later Wave

---

## 8. Detailed Sprint Breakdown

## Sprint 0.1: Repo and Runtime Foundation

### Task 1: Add the `api` service skeleton

**Files:**

- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/src/index.ts`
- Create: `api/src/app.ts`
- Create: `api/src/config/env.ts`
- Create: `api/src/routes/health.ts`
- Test: `api/test/health.test.ts`

**Steps:**

1. Create a minimal Fastify app with `GET /health`.
2. Add env parsing and structured startup logging.
3. Add a smoke test proving the service boots.
4. Add `npm run build`, `npm run dev`, `npm run test`.

**Verify:**

- `npm --prefix api test`
- `npm --prefix api run build`

### Task 2: Add API plugins for auth, Supabase, and audit logging

**Files:**

- Create: `api/src/plugins/supabase.ts`
- Create: `api/src/plugins/auth.ts`
- Create: `api/src/plugins/audit.ts`
- Create: `api/src/plugins/errors.ts`
- Test: `api/test/bootstrap.test.ts`

**Steps:**

1. Instantiate server-side Supabase client with service role.
2. Verify JWT from Supabase auth.
3. Standardize request user context.
4. Add central error mapping and audit writer helper.

**Verify:**

- unauthenticated mutation request returns `401`
- authenticated request reaches handler and records actor metadata

### Task 3: Introduce front-end routing and API client

**Files:**

- Modify: `package.json`
- Modify: `src/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/app/layouts/AppShell.tsx`
- Create: `src/api/client.ts`
- Create: `src/pages/discovery/DetectionPage.tsx`
- Create: `src/pages/projects/ProjectListPage.tsx`

**Steps:**

1. Add `react-router-dom`.
2. Move current shell state into route-based navigation.
3. Keep discovery pages mounted through the new router.
4. Add API client with shared error parsing.

**Verify:**

- `npm run typecheck`
- `npm run build`
- direct navigation to `/projects` and `/discovery/detection` works in preview

### Task 4: Add Railway and CI readiness for three services

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `docs/platform/env-matrix.md`
- Create: `api/README.md`

**Steps:**

1. Add `api` job to CI.
2. Document required env variables and service roots.
3. Add service health endpoints and expected deploy commands.

**Verify:**

- GitHub Actions passes all three jobs
- Railway can point three services at three roots without ambiguous build commands

## Sprint 0.2: Core Data Skeleton And Write Authority

### Task 5: Add Wave 0 backbone migrations

**Files:**

- Create: `supabase/migrations/20260414010000_wave0_foundation_backbone.sql`
- Create: `supabase/migrations/20260414_wave0_rls_hardening.sql`

**Steps:**

1. Create `sites`, `scan_candidates`, `scan_candidate_evidences`, `leads`, `lead_confirmations`, `project_stage_states`, `workflow_audit_logs`.
2. Extend `projects` with `site_id`, `lead_id`, `project_code`, `workflow_status`.
3. Add timestamps, indexes, and uniqueness constraints.
4. Tighten RLS for business-write tables.

**Verify:**

- `supabase db push` or equivalent migration apply succeeds
- schema diff is clean

### Task 6: Implement candidate materialization from scan evidence

**Files:**

- Create: `api/src/modules/candidates/candidate.schemas.ts`
- Create: `api/src/modules/candidates/candidate.repo.ts`
- Create: `api/src/modules/candidates/candidate.service.ts`
- Create: `api/src/routes/candidates.ts`
- Test: `api/test/candidates.test.ts`

**Steps:**

1. Read `scan_sessions`, `scan_screenshots`, and `detection_results`.
2. Group evidence into governed candidates.
3. Generate `candidate_code`.
4. Persist evidence mappings and audit rows.

**Verify:**

- one real scan session can be materialized into candidate rows
- rerun is idempotent

### Task 7: Implement lead creation and dual confirmation

**Files:**

- Create: `api/src/modules/leads/lead.schemas.ts`
- Create: `api/src/modules/leads/lead.repo.ts`
- Create: `api/src/modules/leads/lead.service.ts`
- Create: `api/src/routes/leads.ts`
- Test: `api/test/leads.test.ts`

**Steps:**

1. Create lead only from approved candidate.
2. Seed `sales` and `technical` confirmation rows.
3. Enforce dual confirmation state machine.
4. Log approval/rejection decisions.

**Verify:**

- lead cannot be created from non-approved candidate
- project creation is blocked until both confirmations pass

### Task 8: Implement project bootstrap and stage-state initialization

**Files:**

- Create: `api/src/modules/projects/project.schemas.ts`
- Create: `api/src/modules/projects/project.repo.ts`
- Create: `api/src/modules/projects/project.service.ts`
- Create: `api/src/modules/workflow/stage-state.service.ts`
- Create: `api/src/routes/projects.ts`
- Test: `api/test/projects.test.ts`
- Modify: `src/hooks/useProjects.ts`

**Steps:**

1. Create project from qualified lead only.
2. Generate `project_code`.
3. Create initial `project_stage_states`.
4. Replace front-end direct project creation with API call.

**Verify:**

- project appears in dashboard list after API creation
- `project_stage_states` rows are initialized correctly

### Task 9: Build the minimum Candidate Center and Lead Center pages

**Files:**

- Create: `src/pages/candidates/CandidateListPage.tsx`
- Create: `src/pages/candidates/CandidateDetailPage.tsx`
- Create: `src/pages/leads/LeadListPage.tsx`
- Create: `src/pages/leads/LeadDetailPage.tsx`
- Create: `src/api/candidates.ts`
- Create: `src/api/leads.ts`
- Modify: `src/components/LifecycleSidebar.tsx`

**Steps:**

1. Add candidate inbox and detail.
2. Add lead inbox and detail.
3. Connect action buttons to API.
4. Surface review, confirmation, and conversion states.

**Verify:**

- approved candidate can create lead from UI
- dual confirmation updates appear immediately

### Task 10: Cut over project list reads and lock down legacy creation paths

**Files:**

- Modify: `src/hooks/useProjects.ts`
- Modify: `src/components/ProjectDashboard.tsx`
- Modify: `supabase/migrations/20260408150517_create_project_lifecycle_tables.sql` only if a follow-up migration is needed instead of direct edit
- Create: `api/src/modules/projects/project-summary.repo.ts`

**Steps:**

1. Change project dashboard list read to `GET /v1/projects`.
2. Remove UI dependence on `create_project_from_enterprise`.
3. Leave old RPC available only for legacy/manual admin path if unavoidable.
4. Confirm no user-facing project creation path bypasses API.

**Verify:**

- browser cannot create project through direct Supabase mutation anymore
- dashboard data remains complete

---

## 9. Acceptance Criteria For Wave 0

Wave 0 is complete only if all of the following are true:

- `api` is deployable on Railway and passes CI.
- `web` can navigate by URL to discovery, candidate, lead, and project pages.
- one existing scan session can be turned into governed candidates.
- one approved candidate can create a lead.
- one dual-confirmed lead can create a project.
- project dashboard reads from API, not direct browser writes.
- business-write tables are no longer anonymously writable from the browser.

---

## 10. Risks And Mitigations

### Risk: Full repo restructure slows delivery

Mitigation:

- do not move current `web` into `apps/web` in Wave 0
- add `api/` beside the existing root app

### Risk: Auth introduction breaks the current internal workflow

Mitigation:

- introduce login/bootstrap in Sprint 0.1
- keep read-only discovery access workable while migrating writes

### Risk: Existing project prototype conflicts with new stage-state model

Mitigation:

- keep `current_phase` and `phase_data` temporarily
- let `project_stage_states` become the authoritative layer

### Risk: Candidate materialization logic becomes over-complicated

Mitigation:

- start with deterministic grouping by enterprise/site/session
- do not attempt fuzzy multi-source merge in Wave 0

---

## 11. Recommended Execution Order

Do not parallelize everything at once. The critical path is:

1. `api` skeleton
2. auth + Supabase plugin
3. router + API client in `web`
4. Wave 0 migrations
5. candidate materialization
6. lead creation + confirmation
7. project bootstrap
8. candidate/lead/project UI pages
9. RLS hardening
10. Railway deploy and smoke test

---

## 12. Immediate Next Step

Execute Sprint 0.1 first. Do not build more major front-end operating pages on top of direct Supabase writes before the `api` service and Wave 0 schema backbone exist.

Plan complete and saved to `docs/plans/2026-04-13-wave0-foundation-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
