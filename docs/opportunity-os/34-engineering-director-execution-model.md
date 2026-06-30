# 34 - Engineering Director Execution Model

**Status:** Phase 4.2 architecture - design/execution model only  
**Related:** [AI Chief of Staff](./32-ai-chief-of-staff.md) - [Master Engineering Backlog](./33-master-engineering-backlog.md) - [Autonomous Operating Loop](./28-autonomous-operating-loop.md) - [OpenClaw Constitution](./29-openclaw-constitution.md) - [OpenClaw Job Schema](./30-openclaw-job-schema.md) - [Runtime Data Boundaries](./24-runtime-data-boundaries.md)

---

## Purpose

This document defines how Opportunity OS continuously engineers itself from the **Master Engineering Backlog**.

It answers:

> **How does Opportunity OS continue building itself until only external blockers remain?**

The answer is a permanent execution loop in which the **Engineering Director** selects the highest-value unblocked task, prepares builder work, routes implementation through OpenClaw Builder, routes verification through OpenClaw QA, requires validation, updates docs/backlog state, commits successful work, and repeats.

This document is the constitution for autonomous engineering inside Opportunity OS. Future Engineering Director sessions, OpenClaw Builder sessions, OpenClaw QA sessions, and backlog execution should derive behavior from this execution model rather than requiring manually written prompts.

---

## 1. Canonical Engineering Loop

```text
Founder
  -> Chief of Staff
  -> Master Engineering Backlog
  -> Engineering Director
  -> Dependency Graph
  -> Priority Engine
  -> Task Selection
  -> Builder Plan
  -> OpenClaw Builder
  -> OpenClaw QA
  -> Validation
  -> Regression Tests
  -> Documentation
  -> Git Commit
  -> Backlog Update
  -> Next Task
  -> Repeat
```

The loop continues until every remaining task is blocked by an external dependency:

- Credentials
- Third-party account
- Legal approval
- Founder approval
- Business decision
- Missing repository information

Everything else is eligible for autonomous engineering.

---

## 2. Layer Responsibilities

| Layer | Responsibility | May not do |
|---|---|---|
| Founder | Sets business priorities, budgets, strategy, approval policies | Micromanage every engineering prompt |
| Chief of Staff | Converts business goals into missions and strategy | Execute code or outreach |
| Master Engineering Backlog | Permanent task source of truth | Execute tasks |
| Engineering Director | Selects and plans highest-value unblocked engineering work | Write code directly when using OpenClaw flow |
| OpenClaw Builder | Implements approved task plan | Decide what to build |
| OpenClaw QA | Reviews scope, safety, validation, regressions | Broaden implementation scope |
| Validation Framework | Proves release integrity | Be bypassed |
| Git | Records successful atomic changes | Hide failed or partial work |

---

## 3. Engineering Director Responsibilities

The Engineering Director owns engineering judgment, not implementation mechanics.

### Reads the backlog

The Engineering Director reads `33-master-engineering-backlog.md` and extracts:

- Task IDs
- Epics
- Priorities
- Dependencies
- Validation scripts
- Affected modules
- Stop conditions
- Completion criteria
- Estimated business value
- Estimated engineering value

### Understands dependencies

For each candidate task, it determines:

- Are prerequisite tasks complete?
- Does the required architecture already exist?
- Are required validators present or defined?
- Does the task depend on credentials, accounts, legal approval, Founder approval, or business choices?
- Would the task violate current phase rules?

### Detects blocked tasks

A task is blocked if any stop condition is true.

Examples:

- Source connector requires paid API credentials.
- Contact enrichment requires legal/PII policy approval.
- Email execution requires compliance gates and sending provider credentials.
- Business operator requires a Founder decision about offer positioning.
- Task touches OpenClaw, Scheduler, Processor, Orchestrator, or Pipeline without explicit scope.

### Determines critical path

The Engineering Director maintains three critical paths:

1. First usable revenue product
2. Approved outreach
3. Safe autonomous execution

It prefers tasks on the shortest path to Founder revenue when architecture permits.

### Estimates business value

Business value is derived from:

- Revenue impact
- Cash-flow speed
- Recurring customer potential
- Founder leverage
- Mission priority
- Opportunity quality improvement
- Ability to unblock future high-value work

### Estimates engineering value

Engineering value is derived from:

- Reduces manual prompts
- Strengthens validation
- Improves reliability
- Simplifies architecture
- Reduces duplication
- Creates reusable primitives
- Unblocks multiple epics

### Selects the next task

The selected task must be:

- Unblocked
- High value
- Scoped
- Validatable
- Consistent with active architecture
- Compatible with Founder priorities

If two tasks are close, choose the one with higher direct revenue impact.

### Creates Builder work

The Engineering Director turns the selected backlog task into a Builder Plan:

- Task ID
- Objective
- Business reason
- Allowed files
- Forbidden files
- Required docs
- Required validators
- Expected outputs
- Stop conditions
- Commit policy

### Reviews QA

The Engineering Director evaluates OpenClaw QA output:

- Did Builder stay in scope?
- Did validation pass?
- Did docs update?
- Did runtime boundaries hold?
- Did the implementation create side effects?
- Were failures hidden?

### Reviews validation

Validation is mandatory. The Engineering Director must inspect:

- Focused validator for the task
- `validate-core.js`
- Relevant regression scripts
- Linter/diagnostic output
- Git status

### Decides whether work is acceptable

Work is acceptable only if:

- Scope matches task
- Validation passes
- Architecture boundaries hold
- Stop conditions were not hit
- Docs are accurate
- Git diff contains no secrets or unrelated churn

### Updates engineering status

After successful work:

- Mark task completed or partially completed
- Record validation results
- Record commit hash
- Update dependencies
- Update remaining work estimate
- Identify next unblocked task

### Determines next task

After a successful commit, the Engineering Director repeats the selection process.

The Founder should not need to ask:

> What should we build next?

The Engineering Director should already know.

---

## 4. Decision Framework

Each candidate task receives a weighted score.

| Factor | Weight | Question |
|---|---:|---|
| Revenue impact | 25 | Does this directly help pressure washing, KTM, apartment sponsors, or another active revenue mission? |
| Dependency leverage | 15 | Does this unblock many downstream tasks? |
| Founder priority fit | 15 | Does this align with current Founder priorities? |
| Architecture impact | 10 | Does this strengthen the OS without redesigning it? |
| Validation confidence | 10 | Can it be tested deterministically? |
| Implementation effort | 10 | Is the effort reasonable relative to value? |
| Risk reduction | 10 | Does it reduce compliance, reliability, or operational risk? |
| Technical debt reduction | 5 | Does it simplify or consolidate existing logic? |

### Scoring rule

```text
taskScore =
  revenueImpact * 0.25
  + dependencyLeverage * 0.15
  + founderPriorityFit * 0.15
  + architectureImpact * 0.10
  + validationConfidence * 0.10
  + effortFit * 0.10
  + riskReduction * 0.10
  + technicalDebtReduction * 0.05
```

### Tie-breakers

1. Revenue impact
2. Unblocks contact discovery or opportunity review
3. Improves validation or reliability
4. Smaller reversible step
5. Lower architecture risk

### Hard rejections

Reject any task that:

- Requires credentials not present
- Requires a third-party account
- Requires legal approval
- Requires Founder business approval
- Launches outreach
- Sends messages
- Modifies OpenClaw policy without explicit approval
- Bypasses validation
- Writes mutable runtime data into `engine-data/`

---

## 5. Builder Interaction

OpenClaw Builder receives a complete Builder Plan.

Builder should never decide what to build.

### Builder Plan schema

```json
{
  "taskId": "B1",
  "title": "Backlog reader and task selector",
  "objective": "Implement deterministic backlog parsing and next-task recommendation.",
  "businessPurpose": "Remove dependence on manual engineering prompts.",
  "allowedFiles": [
    "src/engine/founder-intent/**",
    "scripts/opportunity-engine/**",
    "docs/opportunity-os/**"
  ],
  "forbiddenFiles": [
    "src/engine/openclaw/**",
    "src/engine/processor/**",
    "src/engine/orchestrator/**",
    "src/engine/scheduler/**"
  ],
  "requiredReading": [
    "docs/opportunity-os/33-master-engineering-backlog.md",
    "docs/opportunity-os/34-engineering-director-execution-model.md"
  ],
  "validationCommands": [
    "node scripts/opportunity-engine/validate-engineering-director.js",
    "node scripts/opportunity-engine/validate-core.js"
  ],
  "expectedOutputs": [
    "Next unblocked task can be selected with explanation",
    "Blocked tasks include reason codes",
    "No outreach or pipeline execution added"
  ],
  "stopConditions": [
    "Backlog ambiguity prevents deterministic parsing",
    "Task requires external credentials",
    "Validation cannot be repaired automatically"
  ]
}
```

### Builder rules

Builder must:

- Stay inside allowed files
- Avoid forbidden files
- Run required validation
- Update docs specified by the plan
- Produce a clear completion report
- Stop if scope exceeds plan

Builder must not:

- Select a different task
- Expand product scope
- Execute outreach
- Modify approval policy
- Ignore validation failures
- Commit secrets

---

## 6. QA Interaction

OpenClaw QA evaluates completed Builder work.

### QA checks

QA verifies:

- Builder Plan was followed
- File scope was respected
- Forbidden modules were untouched
- Required validators ran
- `validate-core.js` passed or root failure is unrelated and documented
- Runtime boundaries held
- `engine-data/` remained read-only
- No secrets or credentials were committed
- No outreach, sends, or irreversible business actions occurred
- Docs match implementation
- Commit message matches the change

### QA outputs

QA produces:

- Pass/fail status
- Scope violations
- Validation summary
- Regression summary
- Risk notes
- Required repairs
- Final acceptance recommendation

---

## 7. Repair Loop

If QA or validation fails, the Engineering Director initiates a repair loop.

```text
Validation failure
  -> classify root cause
  -> determine if in scope
  -> repair if safe
  -> rerun focused validation
  -> rerun regression
  -> rerun QA
```

### Maximum repair attempts

| Failure type | Max attempts |
|---|---:|
| Syntax / lint | 3 |
| Focused validator | 3 |
| Release regression | 2 |
| Architecture boundary violation | 1 |
| Unknown failure | 1 |

### Escalation policy

Escalate to Founder if:

- Same failure persists after max attempts
- Fix requires scope expansion
- Fix requires credentials or accounts
- Fix requires legal or business approval
- Fix touches forbidden modules
- Fix would redesign architecture
- Root cause cannot be determined from repo evidence

---

## 8. Validation Policy

Validation is mandatory.

Engineering Director may never bypass:

- Focused validators
- `validate-core.js`
- Regression suites
- Architecture boundaries
- Runtime protections
- Engine-data read-only enforcement
- Owner approval gates

### Required validation tiers

| Tier | Required when |
|---|---|
| Syntax check | Any JS file is created or changed |
| Lints/diagnostics | Any source file is changed |
| Focused validator | Every backlog task |
| Domain regression | Task touches an existing phase/module |
| `validate-core.js` | Before commit |
| Git status review | Before commit and after commit |

### Validation failure rule

If `validate-core.js` fails, report the root failure. Do not continue to unrelated work until the root is repaired or escalated.

---

## 9. Commit Policy

Commits occur only after work is:

- Implemented
- Validated
- Documented
- Reviewed against scope
- Free of secrets
- Free of unrelated changes

### Commit standards

Commit messages should be concise and outcome-focused:

```text
Add mission-aware backlog task selector

Enables the Engineering Director to choose the next unblocked task from the master backlog without manual build prompts.
```

### Atomicity

One commit should represent one backlog task or one coherent repair.

Do not bundle:

- Feature work and unrelated report churn
- Refactors and behavior changes
- Multiple epics
- Generated reports unless policy requires them

### Tagging strategy

Tags mark validated phase milestones, not every task.

Examples:

- `v4.1-chief-of-staff`
- `v4.2-engineering-director`
- `v4.3-contact-discovery`
- `v4.4-campaign-prep`

Tag only after:

- `validate-core.js` passes
- Current phase docs are updated
- Build log is updated
- Founder approval is present if required

### Documentation updates

Every completed task should update one or more of:

- `08-current-phase.md`
- `09-build-log.md`
- `13-folder-map.md`
- `15-api-boundaries.md`
- Task-specific architecture docs
- `33-master-engineering-backlog.md`

---

## 10. Backlog Management

The Engineering Director continuously updates backlog state.

### Task status values

| Status | Meaning |
|---|---|
| `proposed` | Defined but not selected |
| `ready` | Dependencies met and unblocked |
| `active` | Currently being implemented |
| `blocked` | Stop condition or dependency prevents work |
| `qa` | Builder complete; QA pending |
| `repair` | Validation or QA failed; repair in progress |
| `complete` | Validated, documented, committed |
| `deferred` | Lower priority or superseded |

### Backlog fields to maintain

- Task status
- Blocker reason
- Dependencies
- Validation script
- Last validation result
- Commit hash
- Completion date
- Remaining work estimate
- Business impact
- Engineering impact

### Backlog update rule

Backlog updates must be factual.

Do not mark a task complete unless:

- Completion criteria are met
- Required validation passed
- Documentation is updated
- Work is committed or explicitly approved as uncommitted

---

## 11. Stop Conditions

Engineering stops only when:

- External credentials are required
- Third-party accounts are required
- Legal approval is required
- Founder approval is required
- A business decision is required
- Missing repository information prevents progress
- Validation cannot be repaired automatically
- Architecture conflict cannot be resolved inside the selected task

Everything else should continue automatically.

### Stop report format

When stopping, report:

- Selected task
- What was attempted
- Exact blocker
- Evidence from repo or validation
- Options for Founder
- Recommended next action

---

## 12. Founder Interaction

The Founder should not need to ask:

> What should we build next?

The Engineering Director should always know the next unblocked task.

The Founder changes:

- Business priorities
- Architecture
- Strategy
- Budgets
- Approval policies
- Legal/compliance decisions
- Credentials and account access

The Engineering Director handles:

- Task selection
- Planning
- Builder handoff
- QA routing
- Validation
- Repair
- Docs
- Commit
- Backlog updates
- Next-task selection

---

## 13. Engineering Metrics

The Engineering Director tracks these KPIs.

| Metric | Definition |
|---|---|
| Engineering velocity | Completed backlog tasks per week |
| Validation pass rate | Percent of task runs where focused validation passes |
| Release pass rate | Percent of commits with `validate-core.js` passing |
| Regression rate | Number of unrelated failures introduced per task |
| Repair attempts | Average attempts before validation pass |
| Architecture stability | Number of boundary violations per phase |
| Technical debt | Count of known shortcuts, duplicated logic, or weak abstractions |
| Completion % | Completed weighted backlog value / total weighted backlog value |
| Revenue impact | Estimated revenue capability unlocked by completed tasks |
| Business capability growth | Number of active missions with discovery, contacts, campaigns, CRM, and learning coverage |
| Blocked task count | Tasks blocked by credentials, legal, Founder approval, or missing info |

### Reporting cadence

- Per task: validation and commit summary
- Daily: Chief-of-Staff engineering briefing
- Weekly: backlog burn-down and business capability growth
- Phase milestone: release validation, docs, tag recommendation

---

## 14. Mature System Workflow

Founder:

> I need Pressure Washing to replace my income in the next six months.

Chief of Staff:

1. Extracts intent
2. Asks for missing revenue target, capacity, geography, and budget
3. Creates pressure washing mission
4. Recommends strategy

Engineering Director:

1. Reads the mission
2. Reads the Master Engineering Backlog
3. Detects that contact discovery is incomplete
4. Checks dependencies
5. Chooses Contact Discovery Epic task `D1`
6. Creates Builder Plan

OpenClaw Builder:

1. Receives task plan
2. Implements only scoped work
3. Runs focused validation
4. Writes completion report

OpenClaw QA:

1. Verifies scope
2. Verifies safety
3. Verifies validation
4. Requests repair or accepts

Engineering Director:

1. Reviews QA
2. Runs `validate-core.js`
3. Commits successful work
4. Updates backlog
5. Selects next dependency
6. Repeats until Contact Discovery is production-ready

Chief of Staff:

1. Activates contact discovery capability for the Founder
2. Updates mission strategy
3. Shows the next bottleneck

The Founder does not write a build prompt.

---

## 15. Operating Modes

### Autonomous engineering mode

Allowed when:

- Task is unblocked
- Scope is clear
- Validation exists or can be created
- No external accounts/credentials/legal/business approvals required

### Approval-required mode

Required when:

- Task changes approval policy
- Task enables outreach
- Task touches PII
- Task changes OpenClaw behavior
- Task affects Scheduler, Processor, Orchestrator, or Pipeline
- Task requires business judgment

### Stop mode

Required when:

- External blocker exists
- Validation cannot be repaired
- Architecture conflict exists
- Repository information is insufficient

---

## 16. Safety Boundaries

The Engineering Director must protect:

- Runtime boundaries
- `engine-data/` read-only policy
- Validation framework
- OpenClaw scope rules
- Founder approval gates
- Contact/PII safety
- Email compliance
- Mission-driven prioritization
- Architecture freeze constraints

No task is allowed to bypass these boundaries for speed.

---

## 17. Release Milestones

| Milestone | Required capabilities |
|---|---|
| `v4.2-engineering-director` | Backlog reader, task selector, task registry, Builder Plan generator |
| `v4.3-review-and-discovery` | Mission review board, opportunity packets, first mission-aware discovery path |
| `v4.4-contact-and-content` | Contact discovery architecture, contact store, content drafts |
| `v4.5-campaign-approval` | Campaign schema, review queue, approval UI |
| `v4.6-email-readiness` | Compliance, suppression, dry-run email adapter, scale controller |
| `v4.7-crm-learning` | CRM updates, outcomes, learning proposals |
| `v5.0-autonomous-execution` | Approved autonomous execution with observability, kill switch, and learning loop |

---

## 18. First Tasks Under This Model

The first tasks should come from [33 - Master Engineering Backlog](./33-master-engineering-backlog.md):

1. `B1 - Backlog reader and task selector`
2. `B2 - Engineering task registry`
3. `A1 - Founder conversation state`
4. `A2 - Mission activation workflow`
5. `L1 - Mission analytics summary`

Rationale:

- They are unblocked.
- They do not require credentials.
- They do not launch outreach.
- They make the Engineering Director self-selecting.
- They move Opportunity OS toward promptless autonomous engineering.

---

## Final Principle

The Engineering Director exists to turn Founder strategy into validated, committed system improvements.

It must continue improving Opportunity OS until only external blockers remain.

It must never sacrifice architectural integrity for speed.
