# HVAC Interval Estimation And Image Speed Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recompute enterprise HVAC estimates from cooling-tower count plus detected tower size, and make enterprise detail satellite images load quickly.

**Architecture:** Add enterprise-level tower-size aggregates plus interval estimate details, then centralize recomputation so every detection write path updates the same enterprise HVAC fields. For image speed, stop using full-size originals for detail thumbnails, generate lightweight preview sources, and prewarm the full-size assets before opening the lightbox.

**Tech Stack:** React, TypeScript, Vite, Supabase Postgres, Supabase Storage

---

### Task 1: Extend enterprise data model for tower-size aggregates

**Files:**
- Create: `supabase/migrations/20260413_add_hvac_interval_fields.sql`
- Modify: `src/types/enterprise.ts`

**Step 1: Write the failing test**

Add a TypeScript-level test that expects enterprise HVAC detail payloads and tower-size aggregate fields to exist in the runtime type contract.

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/hvacCalculator.test.ts`
Expected: FAIL because the new fields and payload shape do not exist yet.

**Step 3: Write minimal implementation**

Add new enterprise fields for:
- `detected_tower_total_area_m2`
- `detected_tower_avg_area_m2`
- `detected_tower_max_area_m2`
- `hvac_estimate_details`

Add the matching SQL migration with safe `add column if not exists`.

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/hvacCalculator.test.ts`
Expected: PASS for the type-backed shape checks.

**Step 5: Commit**

```bash
git add supabase/migrations/20260413_add_hvac_interval_fields.sql src/types/enterprise.ts src/utils/hvacCalculator.test.ts
git commit -m "feat: add enterprise hvac interval fields"
```

### Task 2: Rework HVAC estimation around count plus detected tower size

**Files:**
- Modify: `src/utils/hvacCalculator.ts`
- Create: `src/utils/hvacCalculator.test.ts`

**Step 1: Write the failing test**

Cover:
- zero-tower enterprise returns zeroed metrics
- larger detected tower area increases typical cooling capacity
- interval details include conservative, typical, aggressive variants
- missing real-world scale falls back to count-based interval estimates

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/hvacCalculator.test.ts`
Expected: FAIL because the current calculator only uses tower count.

**Step 3: Write minimal implementation**

Implement a calculator that:
- derives a count baseline from tower count
- derives a size baseline from detected tower area
- blends both into conservative/typical/aggressive scenarios
- outputs the existing enterprise HVAC summary fields from the typical scenario
- outputs interval metadata in `hvac_estimate_details`

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/hvacCalculator.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/hvacCalculator.ts src/utils/hvacCalculator.test.ts
git commit -m "feat: estimate hvac from tower count and size"
```

### Task 3: Centralize enterprise HVAC recomputation after detections

**Files:**
- Create: `src/utils/enterpriseHvac.ts`
- Create: `src/utils/enterpriseHvac.test.ts`
- Modify: `src/utils/detectionPersistence.ts`
- Modify: `src/utils/addressUploadEnterprise.ts`
- Modify: `src/utils/enterpriseMatcher.ts`
- Modify: `src/components/EnterpriseDetail.tsx`

**Step 1: Write the failing test**

Cover:
- enterprise aggregates recompute from `detection_results + scan_screenshots + scan_sessions`
- meters-per-pixel uses zoom and latitude
- save paths call the shared recompute helper

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/enterpriseHvac.test.ts`
Expected: FAIL because no centralized recompute helper exists.

**Step 3: Write minimal implementation**

Add a shared helper that:
- loads the enterprise
- loads linked detections and screenshot/session metadata
- converts bbox area to approximate `m²`
- aggregates tower-size metrics
- computes HVAC metrics
- updates the enterprise row once

Update all detection-related write paths to call this helper instead of hand-writing partial enterprise fields.

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/enterpriseHvac.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/enterpriseHvac.ts src/utils/enterpriseHvac.test.ts src/utils/detectionPersistence.ts src/utils/addressUploadEnterprise.ts src/utils/enterpriseMatcher.ts src/components/EnterpriseDetail.tsx
git commit -m "feat: centralize enterprise hvac recomputation"
```

### Task 4: Speed up enterprise detail image loading

**Files:**
- Create: `src/utils/enterpriseImage.ts`
- Create: `src/utils/enterpriseImage.test.ts`
- Modify: `src/components/EnterpriseDetail.tsx`
- Modify: `src/components/ImageLightbox.tsx`
- Modify: `src/hooks/useAnnotatedUpload.ts`
- Modify: `src/utils/annotatedImageGenerator.ts`

**Step 1: Write the failing test**

Cover:
- preview URLs are preferred for detail cards
- full-size URLs are retained for the lightbox
- current image is prewarmed before opening
- annotated image generation prefers a lighter output format when possible

**Step 2: Run test to verify it fails**

Run: `node --test src/utils/enterpriseImage.test.ts`
Expected: FAIL because enterprise detail images currently use the full URL directly.

**Step 3: Write minimal implementation**

Add helper utilities that:
- derive preview URLs for Supabase-hosted images
- keep full-size URLs for zoom/lightbox
- prewarm current and neighboring full-size images

Update enterprise detail cards to use preview-first images with `loading="lazy"` and `decoding="async"`.
Update the lightbox open flow to prewarm the selected full-size image before showing it.
Change annotated image generation/upload to use a lighter format such as WebP where supported.

**Step 4: Run test to verify it passes**

Run: `node --test src/utils/enterpriseImage.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/enterpriseImage.ts src/utils/enterpriseImage.test.ts src/components/EnterpriseDetail.tsx src/components/ImageLightbox.tsx src/hooks/useAnnotatedUpload.ts src/utils/annotatedImageGenerator.ts
git commit -m "fix: speed up enterprise detail images"
```

### Task 5: Verify and ship

**Files:**
- Modify: `docs/plans/2026-04-13-hvac-interval-estimation-and-image-speed.md`

**Step 1: Run targeted tests**

Run:
- `node --test src/utils/hvacCalculator.test.ts`
- `node --test src/utils/enterpriseHvac.test.ts`
- `node --test src/utils/enterpriseImage.test.ts`

Expected: PASS.

**Step 2: Run full verification**

Run:
- `npm run typecheck`
- `npm run build`

Expected: PASS.

**Step 3: Apply database migration**

Run the new Supabase migration in the target environment before relying on the new enterprise fields.

**Step 4: Ship**

```bash
git add .
git commit -m "feat: recompute hvac metrics from tower size and speed detail images"
git push origin main
```
