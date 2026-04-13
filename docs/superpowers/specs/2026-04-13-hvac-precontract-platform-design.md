# HVAC Pre-Contract Platform Design

Date: 2026-04-13

## 1. Summary

This document defines the V1 design for an internal digital system that covers the pre-contract lifecycle of central air-conditioning energy-saving projects.

V1 scope starts at lead intake and ends at contract finalization:

- scan candidate intake
- formal lead management
- project initiation
- information collection
- site survey
- technical and commercial solution production
- bidding
- contract finalization

The system is not positioned as a generic CRM or a pure calculation tool. It is an internal operating platform for pre-sales standardization.

CoolingTowerScan remains an upstream discovery engine. The new system becomes the system of record for formal lead, project, workflow, approval, versioning, and document output.

## 2. Goals

Primary goal:

- make project progress transparent and controllable across the full pre-contract lifecycle

Secondary goals:

- reduce fragmented spreadsheet and document-driven work
- standardize stage gates, handoffs, approvals, and versioning
- accumulate reusable business data for future operating analysis

## 3. Non-Goals for V1

- execution, commissioning, operations, collection, and post-contract lifecycle management
- external customer portal or partner portal
- full online Office-style editing for Word/PPT
- replacing CoolingTowerScan as the scanning and candidate generation engine
- advanced BI, prediction, or financial analytics beyond required operating views

## 4. Product Positioning

Recommended product approach:

- business-operating foundation model

This means V1 must include:

- unified master data
- lead-to-contract workflow backbone
- structured information capture
- core calculation capability
- approval and version governance
- Office/PDF export

This means V1 will not attempt:

- full native document authoring as a product category of its own

## 5. Core Users

V1 is internal-only and serves:

- sales / BD
- pre-sales / solution team
- commercial / bidding team
- legal
- management approvers

The collaboration model is stage-based relay rather than a single owner model or a free-form matrix.

## 6. Core Business Objects

### 6.1 Enterprise

Customer master record that stores:

- enterprise identity
- group / brand relationship
- industry classification
- historical interactions and project references

### 6.2 Site

Project carrier object. A site may be a campus, plant, building, or specific cooling-station location.

All operational work ultimately lands on the site:

- scan evidence
- lead
- project
- survey
- solution
- bidding package
- contract

### 6.3 Scan Candidate

An upstream candidate pushed from CoolingTowerScan. It contains:

- enterprise/site matching result
- cooling tower evidence
- estimated HVAC load or scale
- confidence / rules hit
- screenshots and related proof

### 6.4 Formal Lead

A qualified operating object created after sales and technical confirmation. This is the main object for early commercial follow-up and technical qualification.

### 6.5 Formal Project

A formal project created after passing the lead-to-project gate. It becomes the backbone container for:

- stage progression
- handoff package
- tasks
- approvals
- document versions
- commercial branch selection

## 7. Lifecycle Design

The V1 lifecycle is:

1. Scan candidate
2. Formal lead
3. Formal project
4. Information collection
5. Site survey
6. Solution and commercial preparation
7. Bidding and contract

The platform uses a front-loose / back-tight control model:

- earlier stages focus on progressing and completing missing information
- later stages focus on approval, version freeze, and risk control

## 8. Stage and Gate Rules

### 8.1 Candidate Intake

Candidate intake rule:

- automatic by rule when thresholds are met
- manual review for lower-confidence or incomplete candidates

This produces a candidate review layer rather than letting scan output directly become a lead.

### 8.2 Candidate to Formal Lead

Formal lead creation requires:

- sales confirmation
- technical confirmation

Formal lead is therefore a mixed commercial + technical qualification object.

### 8.3 Formal Lead to Formal Project

This is a strong gate.

Minimum conditions:

- commercial opportunity is judged worth pursuing
- technical pre-qualification is completed

This gate is intentionally stricter than simple lead creation but earlier than full information collection.

### 8.4 Survey to Solution

This is a strong gate.

Minimum conditions:

- survey conclusion completed
- equipment ledger and key findings recorded
- major data gaps and risks explicitly captured

### 8.5 Solution / Commercial Freeze

This is a strong gate.

Minimum conditions:

- technical solution is formed
- savings estimate is formed
- configuration and profit estimate are formed
- commercial branch is explicitly selected as EPC or EMC

### 8.6 Bid Freeze

This is a strong gate.

Minimum conditions:

- technical, commercial, and price packages are complete
- deviation items are confirmed
- scoring simulation or bid evaluation preparation is complete

### 8.7 Contract Finalization

This is a strong gate.

Minimum conditions:

- contract clauses finalized
- annex list finalized
- legal comments recorded
- approval and final version archived

## 9. Collaboration and Responsibility Model

Each stage must have three explicit responsibility slots:

- stage owner
- collaborators
- gate approver

Relay model:

- sales/BD lead the formal lead stage
- pre-sales/solution lead information collection and survey
- solution/commercial lead solution and pricing preparation
- commercial/bidding lead bid packaging
- commercial with legal support lead contract finalization

The system must not treat handoff as a simple status update. Each handoff is a structured package that includes:

- stage conclusion
- mandatory deliverables
- open risks
- incomplete items
- follow-up responsibility

All exceptions must be traceable:

- skip-step request
- waiver approval
- missing information
- reason for continued progression

## 10. Approval Strategy

Approval model:

- approvers are configured per stage

V1 does not rely on a single manager approval chain for all steps.

Typical approvers:

- lead/project gate: sales or pre-sales manager
- survey-to-solution gate: solution owner or solution manager
- commercial freeze and bid freeze: commercial manager
- contract finalization: legal or authorized management approver

## 11. Commercial Branching

Commercial branch rule:

- pre-solution stages are shared
- branching occurs at the commercial stage

Two supported branches in V1:

- EPC
- EMC

Shared stages:

- lead
- project initiation
- information collection
- survey
- technical solution

Branched stages:

- commercial calculation logic
- pricing structure
- bid content
- contract template and clauses

## 12. Product Modules

Recommended V1 modules:

1. Lead Center
2. Project Center
3. Enterprise and Site Center
4. Information Collection and Survey Center
5. Solution and Calculation Center
6. Bidding and Contract Center
7. Approval and Version Center
8. Operating Dashboard
9. Organization and Permission Configuration

Navigation principle:

- organize by business stage and operating task
- do not organize primarily by file type

## 13. Workbench Design

### 13.1 Role Workbenches

V1 should provide role-oriented workbenches:

- Sales workbench
- Pre-sales workbench
- Commercial/Bidding workbench
- Legal/Management approval workbench

Each workbench highlights:

- waiting items
- blocked items
- overdue items
- gate items requiring action

### 13.2 Project Command Page

The main working page should be a project operating page, not a document repository.

Left-side persistent context:

- stage timeline
- gate status
- owner / approver
- current gaps and risks

Main work area:

- structured stage forms
- ledgers
- versioned outputs
- approval records
- export/freeze actions

## 14. Data Strategy

V1 uses a three-layer data model.

### 14.1 Structured Master Data

- enterprise
- site
- contact
- lead
- project
- responsibility
- stage state
- approval records
- version index

### 14.2 Structured Stage Data

- pre-qualification results
- information collection forms
- survey records
- equipment ledger
- savings estimate
- configuration list
- profit estimate
- bid deviations
- contract key variables and annexes

### 14.3 Output Document Assets

- exported Word / Excel / PPT / PDF
- attached to formal version records

Output files are result assets, not the primary workflow carrier.

## 15. Document Strategy

V1 document principle:

- business data drives templates

The system stores and governs:

- structured content
- approval status
- formal version snapshots

The system exports:

- pre-evaluation forms
- information collection packs
- survey reports
- technical and commercial solutions
- quotations
- bid packages
- EPC/EMC contracts and annex bundles

Formal version rule:

- only a freeze action creates a formal version

Normal edits remain working-state data. Formal versions are generated only at actions such as:

- solution freeze
- quotation freeze
- bid freeze
- contract finalization

Each formal version must capture:

- version number
- generated files
- approval snapshot
- difference baseline against prior version

## 16. Integration Strategy with CoolingTowerScan

Integration model:

- CoolingTowerScan remains the upstream scanning system
- the new system becomes the master system after formal lead/project creation

Sync strategy:

- receive candidate/site/evidence from CoolingTowerScan
- maintain formal lead, project, workflow, approval, and final artifacts in the new system
- optionally return limited outcome labels back upstream

This is a master-subordinate integration model rather than a symmetric two-system workflow.

## 17. Error Handling and Exception Handling

Required exception scenarios:

- candidate with incomplete enterprise/site match
- duplicate enterprise or duplicate site candidates
- candidate confidence below threshold
- lead missing required dual confirmation
- project attempting to pass gate with missing mandatory deliverables
- branch mismatch between commercial assumptions and chosen EPC/EMC path
- export attempted before formal freeze
- contract finalization attempted without legal approval

System response principles:

- block when a strong gate is violated
- allow controlled exception only through waiver with trace
- keep auditability for all bypass actions

## 18. Security and Permissions

V1 permission model must support:

- role-based access
- stage-based action rights
- approver rights per stage
- restricted legal/contract operations
- export and final-version operation controls

This is sufficient for V1. A more advanced attribute-based matrix can be deferred.

## 19. Success Criteria

Within three months after launch, the system should make the following visibly true:

- project progress, blockers, gaps, ownership, and gate status are transparent
- repeated work caused by folders, chat messages, and uncontrolled templates is reduced
- approvals and formal versions are traceable
- lead quality, project conversion, estimate outputs, and pricing data begin to accumulate as reusable operating assets

Primary success criterion:

- project progress becomes transparent and controllable

## 20. Implementation Boundary for V1

V1 must include:

- scan candidate intake
- candidate review
- formal lead management
- enterprise/site master data
- project creation and stage progression
- information collection
- survey and equipment ledger
- solution and calculation center
- EPC/EMC branching at commercial stage
- bidding preparation
- contract finalization
- stage approvals
- version freeze and export
- dashboards and role workbenches

V1 must not include:

- post-contract delivery lifecycle
- external collaboration portal
- full native Office-like document editing
- advanced BI and predictive decisioning

## 21. Open Design Decision Closed in This Spec

The following decisions were explicitly fixed during design review:

- scope is pre-contract only
- system is internal only
- V1 priority is process standardization
- V1 target is full-internal operating foundation with Office export
- first design priority is project backbone, not isolated calculators or bid factory
- process control model is semi-structured
- organization model is stage relay
- project starts after formal lead passes the lead-to-project gate
- lead pool is commercial + technical mixed
- CoolingTowerScan is embedded as upstream discovery, not the same product
- master data uses enterprise + site dual model
- formal lead requires dual confirmation by sales and technical roles
- CoolingTowerScan integration is master-subordinate after handoff
- EPC and EMC share the front pipeline and branch later
- approvals are configured by stage
- control model is front-loose / back-tight
- formal versioning is generated by freeze actions only

