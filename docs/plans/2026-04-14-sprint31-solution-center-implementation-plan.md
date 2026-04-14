# Sprint 3.1 Solution Center Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the minimum Solution Center slice so proposal-stage solution assumptions, savings estimates, and version snapshots become structured project assets.

**Architecture:** Keep the editable draft in `projects.phase_data.proposal.solutionWorkspace`, calculate savings in the API with a pure TypeScript service, and store immutable versions in a dedicated `project_solution_snapshots` table. Expose the workspace through project routes and render it inside the existing `ProjectDetailPage`.

**Tech Stack:** React, TypeScript, Vite, Fastify, Vitest, Supabase Postgres

---

### Task 1: Solution Calculator Baseline

**Files:**
- Create: `api/src/modules/projects/solution-calculator.ts`
- Create: `api/test/solution-calculator.test.ts`

**Step 1: Write the failing test**

Add calculator tests for:
- annual kWh and annual cost saving
- invalid or non-improving assumptions returning gate errors

**Step 2: Run test to verify it fails**

Run: `npm --prefix api test -- solution-calculator.test.ts`
Expected: FAIL because the calculator module does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- calculator input/output types
- baseline and target annual energy calculation
- saving ratio and gate errors

**Step 4: Run test to verify it passes**

Run: `npm --prefix api test -- solution-calculator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add api/src/modules/projects/solution-calculator.ts api/test/solution-calculator.test.ts
git commit -m "feat: add solution savings calculator baseline"
```

### Task 2: Backend Solution Workspace And Snapshots

**Files:**
- Modify: `api/src/modules/projects/project.schemas.ts`
- Modify: `api/src/modules/projects/project.repo.ts`
- Modify: `api/src/modules/projects/project.service.ts`
- Modify: `api/src/routes/projects.ts`
- Modify: `api/test/projects.test.ts`
- Create: `supabase/migrations/20260414030000_sprint31_solution_center.sql`

**Step 1: Write the failing test**

Add API tests for:
- `GET /v1/projects/:projectId/solution-workspace`
- `PATCH /v1/projects/:projectId/solution-workspace`
- `GET /v1/projects/:projectId/solution-snapshots`
- `POST /v1/projects/:projectId/solution-snapshots`
- snapshot gate failure when assumptions are incomplete

**Step 2: Run test to verify it fails**

Run: `npm --prefix api test -- projects.test.ts`
Expected: FAIL because routes and repo methods are missing.

**Step 3: Write minimal implementation**

Implement:
- solution workspace types and repo methods
- solution snapshot table access
- route parsers
- service validation and audit log actions
- draft persistence under `phase_data.proposal.solutionWorkspace`

**Step 4: Run tests to verify they pass**

Run: `npm --prefix api test -- projects.test.ts`
Expected: PASS

**Step 5: Run backend verification**

Run: `npm --prefix api run typecheck`
Expected: PASS

Run: `npm --prefix api run build`
Expected: PASS

**Step 6: Commit**

```bash
git add api/src/modules/projects/project.schemas.ts api/src/modules/projects/project.repo.ts api/src/modules/projects/project.service.ts api/src/routes/projects.ts api/test/projects.test.ts supabase/migrations/20260414030000_sprint31_solution_center.sql
git commit -m "feat: add project solution workspace and snapshots"
```

### Task 3: Frontend Solution Workspace Contract

**Files:**
- Create: `src/utils/projectSolutionWorkspace.ts`
- Create: `src/utils/projectSolutionWorkspace.test.ts`
- Modify: `src/api/projects.ts`

**Step 1: Write the failing test**

Add tests for:
- default draft creation
- payload serialization preserving numeric assumptions
- snapshot list mapping compatibility for snake/camel fields

**Step 2: Run test to verify it fails**

Run: `npx --yes tsx --test src/utils/projectSolutionWorkspace.test.ts`
Expected: FAIL because the helper file does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- solution workspace draft helpers
- serialization helpers
- API request functions for solution workspace and snapshots
- response mappers

**Step 4: Run tests to verify they pass**

Run: `npx --yes tsx --test src/utils/projectSolutionWorkspace.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/projectSolutionWorkspace.ts src/utils/projectSolutionWorkspace.test.ts src/api/projects.ts
git commit -m "feat: add solution workspace web contract"
```

### Task 4: Project Detail Solution Center UI

**Files:**
- Modify: `src/pages/projects/ProjectDetailPage.tsx`

**Step 1: Write the failing test or explicit UI checklist**

If adding a focused unit test is practical, add it first. Otherwise define and follow this verification checklist:
- workspace loads without breaking project detail
- draft can edit summary and assumptions
- save action refreshes gate validation
- snapshot history renders
- snapshot create action shows validation errors inline

**Step 2: Implement minimal UI**

Add:
- `Solution Center` section
- summary inputs
- technical assumption inputs
- read-only calculation cards
- snapshot history list
- save draft and create snapshot buttons

**Step 3: Run frontend verification**

Run: `npm --prefix . run typecheck`
Expected: PASS

Run: `npm --prefix . run build`
Expected: PASS

**Step 4: Run end-to-end project verification**

Run: `npm --prefix api test`
Expected: PASS

Run: `npm --prefix api run typecheck`
Expected: PASS

Run: `npm --prefix api run build`
Expected: PASS

Run: `npx --yes tsx --test src/utils/projectSolutionWorkspace.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat: add project solution center workspace"
```

### Task 5: Wave Plan Status Update

**Files:**
- Modify: `docs/plans/2026-04-13-precontract-platform-wave-plan.md`

**Step 1: Update execution status**

Mark Wave 3 Sprint 3.1 as in progress once implementation starts, then completed only after all verification passes.

**Step 2: Commit**

```bash
git add docs/plans/2026-04-13-precontract-platform-wave-plan.md
git commit -m "docs: update wave plan for sprint 3.1"
```
