# Region Scan Task Flow Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert discovery from a page-driven screenshot workflow into a task-driven region scan flow with a candidate review layer, while keeping the current three-module information architecture.

**Architecture:** Reuse the existing `scan_sessions` and `scan_screenshots` backbone, but promote them into a first-class scan-task workflow. Add a persisted candidate layer between detection output and enterprise records. Update screenshot, detection, overview, and enterprise views to consume the new progression: `scan task -> scan candidate -> enterprise`.

**Tech Stack:** React, TypeScript, Supabase JS client, Supabase SQL migrations, node:test

---

### Task 1: Define the scan-task and candidate data contracts

**Files:**
- Modify: `src/types/pipeline.ts`
- Create: `src/types/scanTask.ts`
- Create: `src/types/scanCandidate.ts`
- Modify: `src/utils/scanSession.ts`
- Modify: `src/utils/scanSessionPersistence.ts`
- Modify: `src/utils/scanSession.test.ts`
- Modify: `src/utils/scanSessionPersistence.test.ts`

**Step 1: Write the failing test**

Add tests proving restored discovery state can distinguish:

- task status
- screenshot progress
- candidate review status

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/scanSession.test.ts src/utils/scanSessionPersistence.test.ts`
Expected: FAIL because the current types only model screenshots and detections, not task and candidate states.

**Step 3: Write minimal implementation**

- Introduce explicit types for scan task and scan candidate
- Keep backward compatibility where current components still depend on `ScanSession`
- Extend state helpers so the pipeline can evolve without rewriting everything at once

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/scanSession.test.ts src/utils/scanSessionPersistence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/pipeline.ts src/types/scanTask.ts src/types/scanCandidate.ts src/utils/scanSession.ts src/utils/scanSessionPersistence.ts src/utils/scanSession.test.ts src/utils/scanSessionPersistence.test.ts
git commit -m "feat: define scan task and candidate contracts"
```

### Task 2: Add candidate persistence between detection and enterprise

**Files:**
- Create: `supabase/migrations/20260415_create_scan_candidates.sql`
- Modify: `src/utils/detectionPersistence.ts`
- Modify: `src/utils/detectionResultMapper.ts`
- Create: `src/utils/scanCandidateRepo.ts`
- Create: `src/utils/scanCandidateRepo.test.ts`

**Step 1: Write the failing test**

Add tests proving a successful detection writes:

- screenshot status
- detection rows
- candidate rows with pending review state

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/scanCandidateRepo.test.ts`
Expected: FAIL because candidate persistence does not exist yet.

**Step 3: Write minimal implementation**

- Create `scan_candidates`
- Persist one or more candidates derived from detection results
- Keep address-mode metadata so later auto-bind rules can be applied cleanly
- Avoid writing region detections directly into enterprises

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/scanCandidateRepo.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260415_create_scan_candidates.sql src/utils/detectionPersistence.ts src/utils/detectionResultMapper.ts src/utils/scanCandidateRepo.ts src/utils/scanCandidateRepo.test.ts
git commit -m "feat: persist scan candidates from detection results"
```

### Task 3: Rebuild the screenshot page into a task-creation flow

**Files:**
- Modify: `src/components/screenshot/index.tsx`
- Modify: `src/components/screenshot/AreaMode.tsx`
- Modify: `src/components/screenshot/AddressMode.tsx`
- Modify: `src/components/screenshot/CaptureEngine.ts`
- Modify: `src/components/screenshot/MapCanvas.tsx`
- Create: `src/components/screenshot/TaskLaunchSummary.tsx`
- Create: `src/components/screenshot/PrecisionPreset.ts`
- Create: `src/components/screenshot/TaskLaunchSummary.test.tsx`

**Step 1: Write the failing test**

Add tests for:

- region mode defaults to search -> draw -> configure -> launch
- precision preset maps to internal zoom and overlap config
- launch summary renders estimated tiles and timing

**Step 2: Run test to verify it fails**

Run: `node --test src/components/screenshot/TaskLaunchSummary.test.tsx`
Expected: FAIL because the launch-summary model and preset mapping do not exist.

**Step 3: Write minimal implementation**

- keep manual coordinate input behind advanced settings
- move the main UI toward region draw and scan strategy selection
- introduce product-level presets instead of exposing raw low-level controls first
- keep the existing capture engine, but feed it from task-level configuration

**Step 4: Run test to verify it passes**

Run: `node --test src/components/screenshot/TaskLaunchSummary.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/screenshot/index.tsx src/components/screenshot/AreaMode.tsx src/components/screenshot/AddressMode.tsx src/components/screenshot/CaptureEngine.ts src/components/screenshot/MapCanvas.tsx src/components/screenshot/TaskLaunchSummary.tsx src/components/screenshot/PrecisionPreset.ts src/components/screenshot/TaskLaunchSummary.test.tsx
git commit -m "feat: turn screenshot flow into scan task creation"
```

### Task 4: Rebuild detection into task review plus candidate actions

**Files:**
- Modify: `src/components/DetectionPanel.tsx`
- Modify: `src/components/detection/ScreenshotGrid.tsx`
- Modify: `src/components/detection/ReviewModal.tsx`
- Create: `src/components/detection/CandidateActionBar.tsx`
- Create: `src/components/detection/CandidateSummaryCards.tsx`
- Modify: `src/hooks/useAnnotatedUpload.ts`
- Modify: `src/hooks/useEnterpriseMatch.ts`
- Modify: `src/utils/annotatedUploadPlan.ts`
- Modify: `src/utils/addressUploadEnterprise.ts`

**Step 1: Write the failing test**

Add tests for:

- region detections create pending candidates rather than immediate enterprise writes
- address detections can still auto-bind or auto-create
- candidate review actions transition status correctly

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/addressUploadEnterprise.test.ts src/utils/annotatedUploadPlan.test.ts`
Expected: FAIL because the current upload and review path does not distinguish candidate lifecycle by mode.

**Step 3: Write minimal implementation**

- load and display candidate review state in detection UI
- add bulk and single-item confirm/reject/bind actions
- keep address mode fast-path automation
- route region mode through candidate confirmation before enterprise creation

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/addressUploadEnterprise.test.ts src/utils/annotatedUploadPlan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/DetectionPanel.tsx src/components/detection/ScreenshotGrid.tsx src/components/detection/ReviewModal.tsx src/components/detection/CandidateActionBar.tsx src/components/detection/CandidateSummaryCards.tsx src/hooks/useAnnotatedUpload.ts src/hooks/useEnterpriseMatch.ts src/utils/annotatedUploadPlan.ts src/utils/addressUploadEnterprise.ts
git commit -m "feat: add candidate review workflow to detection"
```

### Task 5: Reframe discovery shell around task progress and recovery

**Files:**
- Modify: `src/app/layouts/AppShell.tsx`
- Modify: `src/app/router.tsx`
- Create: `src/hooks/useActiveScanTask.ts`
- Create: `src/components/discovery/TaskStatusBanner.tsx`
- Create: `src/components/discovery/RecentTaskList.tsx`
- Create: `src/hooks/useActiveScanTask.test.ts`

**Step 1: Write the failing test**

Add tests proving:

- the active scan task restores from persisted state
- route transitions keep task context
- the shell can show task status independently of the current page

**Step 2: Run test to verify it fails**

Run: `node --test src/hooks/useActiveScanTask.test.ts`
Expected: FAIL because active-task restoration is currently embedded in `AppShell` and not modeled independently.

**Step 3: Write minimal implementation**

- extract active task lifecycle into a dedicated hook
- expose task progress banner across screenshot, detection, and results views
- keep current routes, but anchor them on one active task

**Step 4: Run test to verify it passes**

Run: `node --test src/hooks/useActiveScanTask.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/layouts/AppShell.tsx src/app/router.tsx src/hooks/useActiveScanTask.ts src/components/discovery/TaskStatusBanner.tsx src/components/discovery/RecentTaskList.tsx src/hooks/useActiveScanTask.test.ts
git commit -m "feat: center discovery shell on active scan tasks"
```

### Task 6: Split results overview from enterprise management

**Files:**
- Modify: `src/components/ProjectDashboard.tsx`
- Modify: `src/hooks/useStats.ts`
- Modify: `src/hooks/useEnterprises.ts`
- Modify: `src/components/EnterpriseList.tsx`
- Modify: `src/components/EnterpriseDetail.tsx`
- Create: `src/utils/enterpriseProvenance.ts`
- Create: `src/utils/enterpriseProvenance.test.ts`

**Step 1: Write the failing test**

Add tests proving:

- overview stats can report task and candidate funnel metrics
- enterprise detail can render source provenance

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/enterpriseProvenance.test.ts`
Expected: FAIL because provenance and funnel helpers do not exist.

**Step 3: Write minimal implementation**

- add task and candidate metrics to overview data
- expose source task, screenshot, and candidate identifiers in enterprise detail
- keep enterprise list focused on curated records rather than pending scan output

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/enterpriseProvenance.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ProjectDashboard.tsx src/hooks/useStats.ts src/hooks/useEnterprises.ts src/components/EnterpriseList.tsx src/components/EnterpriseDetail.tsx src/utils/enterpriseProvenance.ts src/utils/enterpriseProvenance.test.ts
git commit -m "feat: add discovery funnel stats and enterprise provenance"
```

### Task 7: Verify the full change set

**Files:**
- Test: `src/utils/scanSession.test.ts`
- Test: `src/utils/scanSessionPersistence.test.ts`
- Test: `src/utils/scanCandidateRepo.test.ts`
- Test: `src/utils/addressUploadEnterprise.test.ts`
- Test: `src/utils/annotatedUploadPlan.test.ts`
- Test: `src/utils/enterpriseProvenance.test.ts`
- Test: `src/hooks/useActiveScanTask.test.ts`
- Test: `src/components/screenshot/TaskLaunchSummary.test.tsx`

**Step 1: Run targeted tests**

Run: `node --test src/utils/scanSession.test.ts src/utils/scanSessionPersistence.test.ts src/utils/scanCandidateRepo.test.ts src/utils/addressUploadEnterprise.test.ts src/utils/annotatedUploadPlan.test.ts src/utils/enterpriseProvenance.test.ts src/hooks/useActiveScanTask.test.ts src/components/screenshot/TaskLaunchSummary.test.tsx`
Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add .
git commit -m "feat: unify discovery as region scan task workflow"
```
