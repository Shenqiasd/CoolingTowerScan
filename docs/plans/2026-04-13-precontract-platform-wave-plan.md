# Pre-Contract Platform Wave Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve CoolingTowerScan into an internal pre-contract operating platform that starts from scan candidate intake and ends at contract finalization, while remaining deployable on Railway.

**Architecture:** Keep a single repo and introduce a Railway-deployed business API as the workflow authority. Preserve the existing scan and detection capabilities as upstream discovery, move formal lead/project/process rules into the API, and use Supabase as the shared system of record for master data, workflow state, approvals, version snapshots, and document assets.

**Tech Stack:** React, TypeScript, Vite, Fastify, Supabase Postgres/Auth/Storage, Python detection service, Railway

---

## Planning Assumptions

- Sprint length: 2 weeks
- Release unit: one Wave = 2 sprints
- Suggested cadence: 5 Waves / 10 sprints / about 20 weeks
- Deployment target: Railway for `web`, `api`, `detection`
- Database target: one Supabase project with controlled migrations
- Working mode: product backbone first, feature breadth second

## Delivery Principles

- Do not let front-end pages directly own core workflow rules
- Candidate, lead, project, approval, and versioning must become server-governed
- Document export is an output capability, not the primary editing model
- Earlier Waves prioritize workflow backbone and data correctness
- Later Waves prioritize freeze, approval, packaging, and governance

## Target Topology

- `web`: existing front-end, expanded into workbench + project operating UI
- `api`: new business API, authoritative for lifecycle, gates, approvals, versioning, and export orchestration
- `detection`: existing Python service, focused on model inference and image processing
- `supabase`: master data, workflow data, approvals, snapshots, assets

---

## Execution Status

- Completed: Wave 0 Sprint 0.1 `Repo and Runtime Foundation`
- Completed: Wave 0 Sprint 0.2 `Core Data Skeleton`
- Completed: Wave 1 Sprint 1.1 `Candidate Center`
- Completed: Wave 1 Sprint 1.2 `Formal Lead Module`
- Completed: Wave 2 Sprint 2.1 `Project Center And Stage Timeline` minimum slice
- Completed: Wave 2 Sprint 2.2 `Information Collection And Survey` minimum slice

Wave 2 Sprint 2.1 completion note:
- `api` now exposes project operating updates, stage updates, and project audit trail
- `web` now has a project center dashboard with workbench summary cards
- project detail page is upgraded into a command page with project-level edits, stage-level edits, and audit visibility

Wave 2 Sprint 2.2 completion note:
- `api` now exposes `GET/PATCH /v1/projects/:projectId/survey-workspace` and `POST /v1/projects/:projectId/survey-complete`
- `api` enforces survey completion gates for required contact, survey record, equipment ledger, missing-info closure, and structured survey-to-proposal handoff
- `web` now adds a Survey Workspace section inside project detail for structured info collection, survey record, equipment ledger, data gaps, and handoffs
- Survey completion status and gate validation are visible in the command page instead of being hidden in ad hoc notes/files

- Completed: Wave 3 Sprint 3.1 `Solution And Calculation Center` minimum slice

Wave 3 Sprint 3.1 completion note:
- `api` now exposes `GET/PATCH /v1/projects/:projectId/solution-workspace`, `GET /v1/projects/:projectId/solution-snapshots`, and `POST /v1/projects/:projectId/solution-snapshots`
- `api` now owns baseline solution savings calculation and snapshot gate validation, backed by `project_solution_snapshots`
- `web` now adds a `Solution Center` section inside project detail for technical assumptions, calculation summary, and snapshot history
- solution drafts remain editable while snapshots create immutable proposal-stage versions for later commercial branching

Next default execution target:
- Wave 3 Sprint 3.2 `EPC / EMC Commercial Branching`

---

## Wave 0: Platform Foundation

### Sprint 0.1: Repo and Runtime Foundation

**Goal:** Create the technical backbone needed for all later Waves.

**Scope:**
- Add `api` service into the repo
- Define shared type package or shared contracts layer
- Split Railway service plan into `web`, `api`, `detection`
- Add environment strategy for local, preview, production
- Add API health, auth context, structured logging, audit logging baseline

**Deliverables:**
- `api` service bootstrapped and deployable on Railway
- shared contracts for candidate/lead/project identifiers and stage enums
- common error envelope and request validation strategy
- environment variable matrix documented
- basic CI covering `web` typecheck/build and `api` typecheck/tests

**Exit Criteria:**
- Railway can deploy `web`, `api`, `detection` independently
- front-end can call `api` health and auth bootstrap endpoints
- Supabase migrations can be applied safely before release

### Sprint 0.2: Core Data Skeleton

**Goal:** Land the minimum master data and workflow schema.

**Scope:**
- Add tables for `sites`, `scan_candidates`, `leads`, `projects`, `project_stage_states`
- formalize `enterprise + site` dual model
- define candidate-to-lead and lead-to-project domain events
- backfill existing enterprise/detection data into candidate-compatible shape

**Deliverables:**
- Supabase migrations for V1 backbone tables
- repository/service layer in `api`
- seed or migration helpers to map current scan output into `scan_candidates`
- project stage enum and initial state machine definition

**Exit Criteria:**
- one scan result can become a persisted `scan_candidate`
- one approved candidate can create a `lead`
- one approved lead can create a `project`

---

## Wave 1: Discovery To Formal Lead

### Sprint 1.1: Candidate Center

**Goal:** Turn current scan output into a governed candidate intake flow.

**Scope:**
- candidate inbox
- candidate review states
- duplicate enterprise/site matching
- evidence panel
- technical confidence and HVAC estimate display

**Deliverables:**
- Candidate Center UI
- `api` endpoints for candidate list, detail, review, dedupe, reject, approve
- candidate status model: `new`, `under_review`, `approved`, `rejected`, `needs_info`
- operator audit log for review actions

**Exit Criteria:**
- scan candidates no longer bypass review
- lower-confidence candidates can be held and annotated
- duplicate candidate handling is explicit and traceable

### Sprint 1.2: Formal Lead Module

**Goal:** Build the formal lead object and dual-confirmation gate.

**Scope:**
- create lead from approved candidate
- sales confirmation + technical confirmation
- lead owner, collaborators, next action, risk summary
- lead dashboard and list filters

**Deliverables:**
- Lead Center UI and detail page
- dual-confirmation workflow enforced by `api`
- lead conversion metrics baseline
- lead audit trail

**Exit Criteria:**
- no project can be created without a formal lead
- dual confirmation is visible and enforced
- lead status is not a loose text field anymore

---

## Wave 2: Project Backbone And Survey Operations

### Sprint 2.1: Project Center And Stage Timeline

**Goal:** Make project the operating container and source of truth.

**Scope:**
- create project from qualified lead
- project command page
- stage timeline
- stage owner / approver / collaborator assignment
- blockers, risks, pending handoffs

**Deliverables:**
- Project Center list and detail
- project operating page replacing the current lightweight dashboard
- stage state transitions controlled by `api`
- role-oriented workbench widgets for waiting, blocked, overdue, gate items

**Exit Criteria:**
- every active opportunity is traceable as a project
- current stage, owner, blockers, and next gate are visible in one page

### Sprint 2.2: Information Collection And Survey

**Goal:** Structure early project input instead of relying on chat/files.

**Scope:**
- information collection form pack
- survey record
- equipment ledger
- mandatory data gaps and risks
- handoff package from info collection to survey and survey to solution

**Deliverables:**
- survey forms and ledger UI
- project handoff record model
- missing-information and waiver model
- survey completion gate validation

**Exit Criteria:**
- survey cannot be marked complete without required fields
- handoff is a structured object, not a status flip
- equipment and risk data become reusable project assets

---

## Wave 3: Solution, Calculation, And Commercial Branching

### Sprint 3.1: Solution And Calculation Center

**Goal:** Move from loose estimates to governed solution versions.

**Scope:**
- solution draft object
- technical assumptions
- savings estimate
- HVAC and load calculation modules
- versioned solution snapshots

**Deliverables:**
- Solution Center UI
- calculation service layer in `api`
- versionable technical solution model
- baseline export for pre-evaluation and solution summary

**Exit Criteria:**
- solution data is structured, versioned, and tied to the project stage
- no formal solution freeze can occur without required calculation inputs

### Sprint 3.2: EPC / EMC Commercial Branching

**Goal:** Introduce controlled commercial branching after shared pre-solution stages.

**Scope:**
- branch selection at commercial stage
- EPC pricing path
- EMC pricing and收益 path
- branch-specific required fields and templates
- freeze gate for solution/commercial package

**Deliverables:**
- commercial branch UI and branch-aware forms
- branch-specific calculation schema
- freeze action creating formal version snapshot
- approval entry for commercial freeze

**Exit Criteria:**
- branch mismatch is blocked
- freeze produces a formal version, not just a saved draft
- EPC and EMC no longer share one loose pricing form

---

## Wave 4: Bidding And Contract Finalization

### Sprint 4.1: Bidding Package

**Goal:** Standardize bid preparation and package completeness.

**Scope:**
- bid package object
- deviation list
- checklist for technical/commercial/price completeness
- bid freeze
- exported bid package asset registry

**Deliverables:**
- Bidding Center UI
- bid completeness rules in `api`
- bid package export orchestration
- approval for bid freeze

**Exit Criteria:**
- bid package status is transparent
- missing sections block freeze
- generated assets are versioned and archived

### Sprint 4.2: Contract Package And Legal Finalization

**Goal:** Close the V1 lifecycle through controlled contract finalization.

**Scope:**
- contract variable set
- annex list
- legal comments
- contract approval
- final contract version archive

**Deliverables:**
- Contract Center UI
- legal review workflow
- contract finalization gate
- final export and archive bundle

**Exit Criteria:**
- contract cannot finalize without required legal approval
- annexes and variables are structured and auditable
- final contract version is archived with approval snapshot

---

## Wave 5: Hardening, Reporting, And Operational Readiness

### Sprint 5.1: Dashboard And Operational Reporting

**Goal:** Make the platform operationally manageable after rollout.

**Scope:**
- role workbenches
- management dashboard
- lead conversion funnel
- project stage aging
- gate blockage reporting

**Deliverables:**
- Sales / Pre-sales / Commercial / Approval workbenches
- dashboard API endpoints
- project aging and blockage metrics
- adoption instrumentation

**Exit Criteria:**
- managers can see bottlenecks without manual spreadsheet work
- role workbenches become the daily entry point

### Sprint 5.2: Security, Resilience, And Launch Readiness

**Goal:** Make the platform stable enough for internal production use.

**Scope:**
- role-based access hardening
- stage-level action permissions
- audit log reviewability
- backup/recovery runbook
- performance pass on Railway deployment

**Deliverables:**
- permission matrix enforcement in `api`
- release checklist
- migration runbook
- incident/recovery runbook
- production launch checklist

**Exit Criteria:**
- critical actions are permission-checked server-side
- deployment and rollback steps are documented
- internal launch can happen with controlled operational risk

---

## Cross-Wave Technical Tracks

### Track A: Workflow Authority Migration

- progressively move business writes from front-end direct Supabase access into `api`
- start with candidate review, lead creation, project creation, gate progression
- leave non-critical reads in front-end until API stabilizes

### Track B: Document Export

- V1 uses template-driven export only
- Word/Excel/PDF generated by server-side orchestration
- every formal export tied to a version snapshot

### Track C: Detection Integration

- detection remains upstream
- scan evidence enters as candidate input
- only selected outcome labels sync back upstream
- no symmetric workflow ownership between systems

### Track D: Data Governance

- every gate action writes audit records
- waiver and bypass must be structured
- no direct mutable final version state without freeze action

---

## Suggested Team Shape

- 1 full-stack engineer on `web + api` workflow backbone
- 1 front-end engineer on workbench / project UI / forms
- 1 back-end engineer on API, data model, approvals, export
- 1 shared part-time engineer on detection integration and document pipeline
- 1 product/ops owner for gate rules, templates, and stage acceptance

If team size is smaller, keep the same order but reduce parallelism. Do not skip Wave 0 and Wave 1.

---

## Release Gates By Wave

- Wave 0 release gate: deployable `api`, shared contracts, core schema in place
- Wave 1 release gate: candidate review and formal lead are operational
- Wave 2 release gate: project backbone and survey process are operational
- Wave 3 release gate: solution and EPC/EMC branching are operational
- Wave 4 release gate: bid and contract finalization are operational
- Wave 5 release gate: dashboards, permissions, and launch runbook are operational

---

## Immediate Next Step

Start with Wave 0 Sprint 0.1 and Sprint 0.2 before building any more major pages on the current front-end. The current system already has useful discovery capability; what it lacks is workflow authority, business object separation, and stage governance.
