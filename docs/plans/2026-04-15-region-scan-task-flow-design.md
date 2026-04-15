# Region Scan Task Flow Design

> **Context:** CoolingTowerScan discovery flow optimization for V1 lead discovery.

**Goal:** Replace the current page-driven screenshot workflow with a task-driven region scan flow that starts from map positioning, continues through AI detection and candidate review, and lands cleanly in results overview and enterprise management.

**Recommended Approach:** Keep the existing three modules, but unify them behind a new `scan task -> scan candidate -> enterprise` progression. Region capture and address capture both create scan tasks. Detection works against task assets. Only confirmed or rule-qualified results enter enterprise management.

## Options Considered

### Option A: Keep three modules, unify them as one task flow

**Pros**
- Smallest product and code migration from the current implementation
- Preserves current routing and operator familiarity
- Allows address mode and region mode to converge on the same data model
- Creates a clean buffer layer between AI output and enterprise master data

**Cons**
- Requires introducing an explicit candidate layer
- Some current pages must change from tool panels into workflow views

### Option B: Build a single-page scan studio

**Pros**
- Smoothest end-user interaction
- Strongest future control center model

**Cons**
- Highest rewrite cost
- Larger divergence from current route and component structure

### Option C: Only optimize area capture UI and keep downstream flow unchanged

**Pros**
- Lowest short-term effort

**Cons**
- Does not solve the current mismatch between screenshot workflow and enterprise management
- AI output continues to mix operational evidence and master data too early

**Decision:** Option A.

## Problem Statement

The current discovery experience exposes implementation details instead of guiding the user through a business workflow:

- area mode still behaves like an internal tool panel with corner coordinates, overlap, and delay controls
- screenshot, detection, and results are separated by route, but the actual state backbone is already the persisted `scan_session`
- address mode can auto-create enterprises, while region mode has no intermediate candidate review layer
- the system can capture and detect, but it does not clearly represent the user intent of "I want to scan this region and review leads from it"

This creates friction in all four modules:

- region screenshot is hard to operate
- AI detection is not framed as a stage of a scan task
- results overview mixes pipeline monitoring and enterprise master data
- enterprise management risks being polluted by unconfirmed region-scan output

## Product Principles

- user operates tasks, not coordinates
- scan evidence and enterprise master data must be separated
- AI output must pass through a reviewable candidate layer before becoming a formal enterprise record
- address scan may auto-bind faster because the business object is already known
- region scan must prioritize broad discovery, review efficiency, and low false-positive pollution

## Target User Flow

### Step 1: Locate target area

The user starts from a search-centric map:

- search industrial park, city, district, or known enterprise
- pan and zoom to the right context
- see existing enterprises and prior scan coverage as background context

### Step 2: Define scan region

The user draws a rectangle on the map, then adjusts it if needed.

The system immediately shows:

- selected area bounds
- approximate area size
- estimated number of screenshots
- estimated AI processing time

The primary interaction is "框选扫描区域". Manual corner coordinates remain available only in advanced mode.

### Step 3: Configure scan strategy

Instead of raw technical controls, the user chooses product-level settings:

- scan precision: coarse / standard / fine
- grid density: auto / custom
- coverage mode: seamless / light overlap
- task name and optional notes

Advanced options may still expose:

- explicit zoom
- overlap ratio
- capture delay

### Step 4: Run scan task

Submitting creates a `scan task` as the first-class object.

The task page shows:

- queued / capturing / detecting / completed / failed status
- live progress
- screenshots generated
- error and retry state

The operator should be able to leave the page and return later to the same task state.

### Step 5: Review AI candidates

Detection results belong to the task and are presented as candidates, not enterprises.

Each candidate supports:

- confirm valid
- mark false positive
- bind to existing enterprise
- create new enterprise
- defer for later review

Address-based scan results may auto-bind or auto-create when confidence and address quality are sufficient.

### Step 6: Land in overview and enterprise management

Results overview shows pipeline performance and conversion:

- tasks created
- screenshots processed
- candidates detected
- candidates confirmed
- candidates converted to enterprises

Enterprise management only receives confirmed or auto-qualified records.

## Domain Model

### 1. Scan Task

Represents one user-initiated scanning job.

Core fields:

- `id`
- `mode`: `region` or `address`
- `name`
- `status`
- `region_bounds` or `center + radius`
- `grid_config`
- `capture_config`
- `progress_counts`
- `started_at`
- `completed_at`
- `owner`

This becomes the workflow container for screenshot and detection stages.

### 2. Scan Screenshot

Evidence asset produced by the task.

Core fields:

- `task_id`
- `storage_url`
- `annotated_url`
- `row_idx`
- `col_idx`
- `lng`
- `lat`
- `capture_status`
- `detection_status`

The existing `scan_screenshots` table is the right base, but it needs to be understood as task evidence rather than a loose artifact list.

### 3. Scan Candidate

The key new layer.

Represents a detection-derived lead hypothesis.

Core fields:

- `task_id`
- `screenshot_id`
- `location`
- `tower_count`
- `confidence`
- `review_status`
- `matched_enterprise_id`
- `reviewer`
- `reviewed_at`
- `candidate_type`: `region` or `address`

This object prevents raw AI output from being written directly into enterprise records.

### 4. Enterprise

Formal master data object.

Rules:

- address-mode candidates may auto-create or auto-bind when confidence and address data are good enough
- region-mode candidates must be confirmed before creating or binding enterprises

## Module Restructuring

### Region Screenshot Module

Current role:

- low-level capture tool

Target role:

- scan task creation workspace

Main UI blocks:

- map search and positioning
- region selection overlay
- scan strategy panel
- task launch summary
- recent task list

### AI Detection Module

Current role:

- batch detect screenshots

Target role:

- task-level candidate review workspace

Main UI blocks:

- selected task summary
- candidate filters
- candidate grid/list
- candidate detail review modal
- bulk actions for confirm / reject / bind

### Results Overview Module

Current role:

- mixed display of enterprise-oriented outcomes

Target role:

- discovery operations dashboard

Main metrics:

- task funnel
- detection quality
- candidate conversion
- industry and geography distribution

### Enterprise Management Module

Current role:

- endpoint for many upstream actions

Target role:

- curated formal records only

Each enterprise should show provenance:

- source scan task
- source screenshot
- source candidate
- confirmation method
- latest evidence images

## Interaction Design Recommendations

### Region Capture UX

Default interaction order:

1. search or pan to area
2. draw region
3. preview grid and cost
4. choose precision
5. start task

Do not make users think in:

- top-left corner first
- bottom-right corner second
- overlap percentage before intent is clear

Those controls should exist only as advanced adjustments.

### Candidate Review UX

Region scan output should be reviewed in a candidate queue with strong triage affordances:

- high-confidence first
- cluster nearby screenshots when possible
- bulk reject obvious false positives
- bulk bind when several candidates belong to the same site

### Address Scan UX

Address scan remains faster and more direct:

- input address
- preview radius and tile count
- run scan
- if towers found, auto-create or auto-bind enterprise

This is a fast path and should not define the model for region scanning.

## Data Flow

### Region Flow

1. User creates scan task from selected region
2. Task generates screenshot assets
3. Detection runs against screenshots
4. Detection emits scan candidates
5. User confirms or rejects candidates
6. Confirmed candidates create or bind enterprises
7. Overview metrics refresh

### Address Flow

1. User searches address and creates scan task
2. Task generates stitched screenshot
3. Detection runs against screenshot
4. If qualified, candidate auto-creates or auto-binds enterprise
5. Overview and enterprise management refresh

## State Model

### Scan Task Status

- `draft`
- `queued`
- `capturing`
- `capture_failed`
- `detecting`
- `review_pending`
- `completed`
- `partial_failed`

### Candidate Review Status

- `pending`
- `confirmed`
- `rejected`
- `bound`
- `converted`

This is more expressive than the current screenshot-only `pending/detected/no_result/error` model.

## Success Criteria

The redesign is successful when:

- an operator can start a region scan without entering coordinates manually
- the product clearly communicates what will be scanned before execution
- AI output from region scans enters a reviewable candidate layer rather than enterprise management directly
- results overview can report discovery funnel metrics, not just end-state enterprise counts
- enterprise records can trace back to source evidence and confirmation decisions

## V1 Scope

### In Scope

- region scan task creation flow
- unified task model for address and region modes
- candidate layer for region scan outputs
- task-centric AI review UI
- overview funnel metrics
- enterprise provenance display

### Out Of Scope

- automatic deduplication across all historical tasks
- advanced spatial clustering beyond basic grouping
- approval workflow for candidate confirmation
- full lead and project conversion workflow

## Implementation Direction

The lowest-risk implementation path is:

- keep existing routes
- reframe screenshot page into task creation
- reframe detection page into task review
- add a candidate persistence layer
- update overview and enterprise detail to show provenance and conversion

This keeps the current application shell intact while moving the product model to the correct business shape.
