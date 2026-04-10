# Address Upload Auto Enterprise Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically create and bind an enterprise record when the user uploads an annotated image for an address-based detection that has cooling towers but no linked enterprise.

**Architecture:** Preserve the resolved address from address search through screenshot capture, persistence, detection, and upload. During annotated upload, if the detection is address-based and unlinked, create or reuse a minimal enterprise row keyed by address, bind the screenshot to that enterprise, and refresh list/map/stats so the new record appears in the results overview immediately.

**Tech Stack:** React, TypeScript, Supabase JS client, Supabase SQL migrations, node:test

---

### Task 1: Preserve resolved address through the scan pipeline

**Files:**
- Modify: `src/components/screenshot/AddressMode.tsx`
- Modify: `src/components/screenshot/CaptureEngine.ts`
- Modify: `src/utils/detectionResultMapper.ts`
- Modify: `src/types/pipeline.ts`
- Modify: `src/utils/scanSessionPersistence.ts`
- Modify: `src/utils/scanSessionPersistence.test.ts`
- Create: `supabase/migrations/20260410_add_resolved_address_to_scan_screenshots.sql`

**Step 1: Write the failing test**

Add a test proving restored scan sessions preserve a stored `resolved_address` from `scan_screenshots`.

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/scanSessionPersistence.test.ts`
Expected: FAIL because restored screenshots/detections do not expose `resolvedAddress`.

**Step 3: Write minimal implementation**

- Store both `name` and full `address` from address search results in `AddressMode`.
- Thread `resolvedAddress` through capture task/result and detection mapping.
- Persist `resolved_address` in `scan_screenshots`.
- Restore `resolvedAddress` from persisted rows.

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/scanSessionPersistence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/screenshot/AddressMode.tsx src/components/screenshot/CaptureEngine.ts src/utils/detectionResultMapper.ts src/types/pipeline.ts src/utils/scanSessionPersistence.ts src/utils/scanSessionPersistence.test.ts supabase/migrations/20260410_add_resolved_address_to_scan_screenshots.sql
git commit -m "feat: persist resolved address for address scans"
```

### Task 2: Add address-based enterprise auto-create helper with TDD

**Files:**
- Create: `src/utils/addressUploadEnterprise.ts`
- Create: `src/utils/addressUploadEnterprise.test.ts`

**Step 1: Write the failing test**

Add tests for:
- creating a minimal enterprise payload from address-based detection data
- preferring exact address reuse over creating a duplicate enterprise
- refusing to auto-create for non-address or no-tower detections

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/addressUploadEnterprise.test.ts`
Expected: FAIL because helper does not exist yet.

**Step 3: Write minimal implementation**

Create a helper that:
- validates auto-create eligibility
- finds an existing enterprise by exact address, then by enterprise name fallback
- inserts a minimal enterprise row when missing
- returns the linked enterprise id plus the enterprise fields that need to be refreshed locally

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/addressUploadEnterprise.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/addressUploadEnterprise.ts src/utils/addressUploadEnterprise.test.ts
git commit -m "feat: add address upload enterprise linking helper"
```

### Task 3: Integrate auto-create into annotated upload and refresh overview data

**Files:**
- Modify: `src/hooks/useAnnotatedUpload.ts`
- Modify: `src/components/DetectionPanel.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Add a test covering the upload plan or helper integration where address-based detections without `enterpriseId` become linked after upload prep.

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/addressUploadEnterprise.test.ts src/utils/annotatedUploadPlan.test.ts`
Expected: FAIL until upload integration uses the helper.

**Step 3: Write minimal implementation**

- Extend annotated upload to auto-create/reuse an enterprise before writing `annotated_image_url`.
- Update `scan_screenshots.enterprise_id` and `enterprises.annotated_image_url`.
- Return enough metadata so `DetectionPanel` can update local detection state and show a useful notice.
- Surface a callback to `App` so upload completion refreshes enterprises, markers, and stats.

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/addressUploadEnterprise.test.ts src/utils/annotatedUploadPlan.test.ts src/utils/scanSessionPersistence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useAnnotatedUpload.ts src/components/DetectionPanel.tsx src/App.tsx
git commit -m "feat: auto-create enterprises from address uploads"
```

### Task 4: Verify the full change set

**Files:**
- Test: `src/utils/addressUploadEnterprise.test.ts`
- Test: `src/utils/annotatedUploadPlan.test.ts`
- Test: `src/utils/scanSessionPersistence.test.ts`
- Test: `src/utils/detectionState.test.ts`
- Test: `src/utils/locationSearch.test.ts`
- Test: `src/utils/rasterViewport.test.ts`

**Step 1: Run targeted tests**

Run: `node --test src/utils/addressUploadEnterprise.test.ts src/utils/annotatedUploadPlan.test.ts src/utils/scanSessionPersistence.test.ts src/utils/detectionState.test.ts src/utils/locationSearch.test.ts src/utils/rasterViewport.test.ts`
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
git commit -m "fix: create enterprises from address image uploads"
```
