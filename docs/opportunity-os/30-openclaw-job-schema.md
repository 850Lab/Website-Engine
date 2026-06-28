# 30 — OpenClaw Job Schema

**Status:** Phase 3.1.7.5 · Schema + Builder Worker + Security Hardening complete  
**Related:** [OpenClaw Constitution](./29-openclaw-constitution.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [API Boundaries](./15-api-boundaries.md) · [Current Phase](./08-current-phase.md)

---

## 1. Purpose

Phase 3.1 defines a **generic Job runtime** — lifecycle, idempotency, retries, dead-letter, and Events. Generic Jobs describe **work units** for any loop stage (`sensor.run`, `fact.build`, `openclaw.build`, …).

OpenClaw requires a **specialized Job schema** because autonomous implementation work is higher risk than pipeline stage handlers:

| Generic Job | OpenClaw Job |
|---|---|
| References upstream artifact IDs (`inputRefs`) | References **owner-approved phase scope** |
| Assumes handler knows what to do | Requires **explicit objective, constraints, and validation commands** |
| Minimal metadata | Requires **owner approval artifact, promptHash, file zones** |
| Any module may enqueue | Only **allowlisted job types and agent roles** |

Without this schema, OpenClaw could act on vague, unscoped, or unapproved work — violating OC1–OC7 ([29-openclaw-constitution.md](./29-openclaw-constitution.md)).

**Phase 3.1.7.5 delivered:** Prompt hash verification against `engine-data/openclaw/prompts/` artifacts; idempotency key formula enforced; command allowlist; forensic reports; terminal event coverage (`failed` + `stopped` + `reported` on every exit).

**Phase 3.1.7 delivered:** `src/engine/openclaw/` validates `metadata.openclaw`, enforces owner approval and file scope, runs approved commands only, writes gitignored reports, emits `openclaw.job.*` Events. CLI: `scripts/openclaw/run-builder-job.js`.

**Contract chain:**

```
Owner
  ↓ (approval + prompt)
Job/Event Runtime (generic Job + metadata.openclaw)
  ↓
OpenClaw Worker (Phase 3.1.7+)
  ↓
Validators
  ↓
Reports
  ↓
Owner approval (next phase)
  ↓
STOP
```

---

## 2. OpenClaw Job Object

The canonical OpenClaw Job schema. At runtime (Phase 3.1.7+), this object lives at **`genericJob.metadata.openclaw`**. Generic Job lifecycle fields remain on the Phase 3.1 Job object ([28 §3](./28-autonomous-operating-loop.md#3-job-model)).

### Canonical schema

```json
{
  "id": "openclaw_job_8f3a2b1c",
  "jobType": "openclaw.build",
  "phaseId": "3.1.7",
  "title": "Implement OpenClaw CLI Worker",
  "objective": "Build manual CLI that claims OpenClaw Jobs and emits Events.",
  "ownerApproval": {
    "approvedBy": "owner",
    "approvedAt": "2026-06-23T00:00:00.000Z",
    "approvalSource": "explicit_prompt",
    "promptExcerpt": "Phase 3.1.7 — OpenClaw CLI Worker",
    "phaseDocStatus": "ACTIVE"
  },
  "agentRole": "builder",
  "scope": {
    "phaseId": "3.1.7",
    "summary": "OpenClaw CLI only — no scheduler",
    "scopeFiles": [
      "scripts/openclaw/**",
      "docs/opportunity-os/08-current-phase.md"
    ],
    "allowedOperations": ["create", "update"]
  },
  "constraints": {
    "architectureFreeze": true,
    "noMissionControlChanges": true,
    "noScoreCouncilChanges": true,
    "noLiveConnectors": true,
    "noScheduler": true,
    "maxPhasesPerJob": 1
  },
  "requiredReading": [
    "docs/opportunity-os/29-openclaw-constitution.md",
    "docs/opportunity-os/30-openclaw-job-schema.md"
  ],
  "allowedFiles": [
    "scripts/openclaw/**",
    "docs/opportunity-os/**"
  ],
  "forbiddenFiles": [
    "src/engine/mission-control/**",
    "src/engine/score-council/**",
    "runtime/**",
    "src/mission-control/**"
  ],
  "requiredCommands": [],
  "validationCommands": [
    "node --check scripts/openclaw/worker.js",
    "node scripts/opportunity-engine/validate-phase-3-1.js"
  ],
  "expectedOutputs": [
    "scripts/openclaw/worker.js",
    "reports/openclaw-completion.md"
  ],
  "commitPolicy": {
    "maxCommits": 1,
    "messageFormat": "Implement {phaseId} {title}",
    "allowRuntimeCommits": false,
    "allowForceAdd": false
  },
  "reportPolicy": {
    "required": true,
    "pathPattern": "reports/openclaw-{phaseId}-{jobId}.md",
    "gitignored": true
  },
  "stopConditions": [
    "phase_blocked",
    "owner_approval_missing",
    "validation_failure",
    "forbidden_file_touched"
  ],
  "idempotencyKey": "openclaw:3.1.7:build:sha256_abc...",
  "promptHash": "sha256:...",
  "status": "pending",
  "createdAt": "2026-06-23T12:00:00.000Z",
  "updatedAt": "2026-06-23T12:00:00.000Z",
  "metadata": {
    "schemaVersion": "3.1.6",
    "genericJobId": "job_uuid",
    "correlationId": "corr_uuid",
    "workerVersion": null
  }
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | OpenClaw Job ID — `openclaw_job_<uuid>`; stable audit identifier |
| `jobType` | enum | yes | Allowlisted type — see [§3 Job Types](#3-job-types) |
| `phaseId` | string | yes | Target phase — e.g. `3.1.7`, `3.2`; must match owner approval |
| `title` | string | yes | Short human-readable job title |
| `objective` | string | yes | One-paragraph scope boundary — what success means |
| `ownerApproval` | object | yes | Proof of owner authorization — see [§5](#5-owner-approval-artifact) |
| `agentRole` | enum | yes | Agent executing job — see [§4 Agent Roles](#4-agent-roles) |
| `scope` | object | yes | File and operation boundaries — see [§7 Scope Rules](#7-scope-rules) |
| `constraints` | object | yes | Hard limits (architecture freeze, no MC, etc.) |
| `requiredReading` | string[] | yes | Constitution docs worker must read before acting |
| `allowedFiles` | string[] | yes | Glob allowlist — changes outside list → stop |
| `forbiddenFiles` | string[] | yes | Glob denylist — always wins over allowlist |
| `requiredCommands` | string[] | no | Commands worker must run during implementation (optional) |
| `validationCommands` | string[] | yes | Commands that must pass before `completeJob` |
| `expectedOutputs` | string[] | yes | Artifacts that must exist on success |
| `commitPolicy` | object | yes | Commit rules — see [§9 Commit Policy](#9-commit-policy) |
| `reportPolicy` | object | yes | Completion report rules — see [§10 Report Policy](#10-report-policy) |
| `stopConditions` | string[] | yes | Hard stop triggers — see [§11 Stop Conditions](#11-stop-conditions) |
| `idempotencyKey` | string | yes | Dedupe key — `openclaw:{phaseId}:{jobType}:{promptHash}` |
| `promptHash` | string | yes | Hash of canonical owner prompt — see [§6](#6-prompt-hashing) |
| `status` | string | yes | Mirrors generic Job status at OpenClaw layer (read-only copy) |
| `createdAt` | ISO8601 | yes | Job creation timestamp |
| `updatedAt` | ISO8601 | yes | Last schema mutation timestamp |
| `metadata` | object | yes | `schemaVersion`, `genericJobId`, `correlationId`, optional `workerVersion` |

**Rule:** OpenClaw Worker **must validate** this schema before `claimJob`. Invalid schema → reject Job, emit `openclaw.job.stopped`.

---

## 3. Job Types

| Job type | Agent role | Phase availability | Status |
|---|---|---|---|
| `openclaw.build` | `builder` | **3.1.7+** | Allowed soon |
| `openclaw.qa` | `qa` | **3.1.8+** | Allowed soon |
| `openclaw.docs` | `documentation` | **3.1.7+** | Allowed soon |
| `openclaw.refactor` | `refactor` | Any | **Blocked** unless job + owner explicitly approve refactor scope |
| `openclaw.research` | `research` | Future | **Blocked** until research boundaries doc exists |
| `openclaw.connector` | `connector` | **3.5+** | **Blocked** until live connector phase |
| `openclaw.execution` | `execution` | **4+** | **Blocked** until execution/outreach phase |

### Type rules

| Rule | Detail |
|---|---|
| **T1** | Worker rejects unknown `jobType` at validation |
| **T2** | Blocked types fail pre-flight with `openclaw.job.stopped` — never `claimJob` |
| **T3** | `jobType` must match `agentRole` allowlist |
| **T4** | Generic Job `type` field **equals** `jobType` (e.g. `openclaw.build`) |

---

## 4. Agent Roles

### Role matrix

| Role | Allowed job types | Forbidden actions | Required validations | Allowed file zones | Stop rules |
|---|---|---|---|---|---|
| **builder** | `openclaw.build` | Outreach; MC/Score Council edits; Constitution amend unless job allows; delete legacy | Phase validator + regressions + `node --check` on new files | `src/engine/**`, `scripts/**`, `docs/opportunity-os/**` per job allowlist | Scope exceeded; validation fail |
| **qa** | `openclaw.qa` | **Any source file writes**; commits (report-only) | All `validationCommands`; git status; boundary grep | Read-only: entire repo except `runtime/**` writes | Any implementation change detected |
| **documentation** | `openclaw.docs` | Engine logic changes; validator logic; runtime writes | Doc lint (future); phase doc consistency check | `docs/opportunity-os/**` only unless job expands | Edit outside docs allowlist |
| **refactor** | `openclaw.refactor` | Architecture redesign; cross-module boundary breaks | Phase validator + module boundary tests | Owner-specified module paths only | **Blocked by default** — owner flag required |
| **research** | `openclaw.research` | Commits; runtime writes; enqueue jobs | None (read-only reports) | Read-only entire repo | **Blocked** until Phase research doc |
| **connector** | `openclaw.connector` | Pipeline intelligence changes; MC | Connector + sensor validators | `src/engine/sensors/**`, approved connector paths | **Blocked until 3.5** |
| **execution** | `openclaw.execution` | Code commits; architecture changes; reasoning | Outcome recording validators | Execution queue adapters only | **Blocked until Phase 4** |

### Role assignment rule

`agentRole` on the OpenClaw Job **must** match the job type's primary role. QA Jobs may reference a `buildJobId` in `metadata` linking to the Builder Job under test.

---

## 5. Owner Approval Artifact

A job is **invalid** if approval cannot be verified. Worker pre-flight **must** check all applicable gates.

### `ownerApproval` object

| Field | Type | Required | Description |
|---|---|---|---|
| `approvedBy` | string | yes | `"owner"` or documented delegate |
| `approvedAt` | ISO8601 | yes | When approval was granted |
| `approvalSource` | enum | yes | `explicit_prompt` \| `phase_doc_active` \| `decision_log_entry` |
| `promptExcerpt` | string | conditional | Required when `approvalSource` is `explicit_prompt` |
| `phaseDocStatus` | enum | yes | Expected: `ACTIVE` — not `BLOCKED` or `COMPLETE` for implementation jobs |
| `decisionLogRef` | string | no | Reference to `09-build-log.md` entry if applicable |

### Acceptable approval artifacts

| Artifact | Verification |
|---|---|
| **Explicit owner prompt** | `promptHash` matches hashed prompt; `promptExcerpt` non-empty |
| **Phase doc approved** | `08-current-phase.md` lists `phaseId` as **ACTIVE** (implementation), not BLOCKED |
| **Matching phaseId** | Job `phaseId` equals active phase in `08-current-phase.md` |
| **Unblocked phase** | Autopilot `ownerApprovalRequired` would not block this phase |

### Rejection cases

| Condition | Result |
|---|---|
| `phaseId` is BLOCKED in `08-current-phase.md` | Invalid — emit `openclaw.job.stopped` |
| `promptHash` missing or malformed | Invalid |
| `ownerApproval.approvedAt` after job `createdAt` by >24h without refresh | Warn + stop unless owner refreshes |
| Implementation job on COMPLETE phase | Invalid — only doc/QA follow-ups with explicit scope |

---

## 6. Prompt Hashing

### Purpose

| Goal | How `promptHash` helps |
|---|---|
| **Prove origin** | Job tied to specific owner prompt text |
| **Prevent drift** | Worker detects if live prompt differs from Job |
| **Reproducibility** | Same prompt + phase → same hash → same idempotency namespace |
| **Audit** | Events and reports reference hash for forensic trace |

### Canonical algorithm (specification only — no implementation in 3.1.6)

```
canonicalPrompt = normalizeWhitespace(ownerPromptText)
promptHash = "sha256:" + SHA256(canonicalPrompt)
idempotencyKey = "openclaw:" + phaseId + ":" + jobType + ":" + promptHash
```

**Normalization rules:**

1. Strip leading/trailing whitespace
2. Normalize line endings to `\n`
3. Collapse repeated blank lines to one
4. Do not strip markdown structure

**Rule:** Worker recomputes hash at claim time. Mismatch → **stop** — do not implement from stale Job.

---

## 7. Scope Rules

### Scope object fields

| Field | Purpose |
|---|---|
| `scopeFiles` | Intended touch set — planning hint for worker |
| `allowedFiles` | **Enforcement allowlist** — globs |
| `forbiddenFiles` | **Enforcement denylist** — overrides allowlist |
| `allowedOperations` | Subset of: `create`, `update`, `delete` |

### Allowed operations (examples)

| Operation | Example |
|---|---|
| Create module | New file under `scripts/openclaw/` approved in job |
| Update validator | `validate-phase-3-1.js` when phase prompt requires |
| Update docs | Files listed in `requiredReading` + phase doc updates |

### Forbidden operations (always)

| Operation | Reason |
|---|---|
| Delete legacy systems | OC14 |
| Amend Constitution | Unless job `scope` explicitly lists constitution files **and** owner amendment prompt |
| Modify Mission Control | Unless job `constraints.noMissionControlChanges: false` + owner approval |
| Change Score Council | Unless explicit approved phase |
| Alter unrelated files | Outside `allowedFiles` |
| Write `runtime/**` to git | Runtime gitignored — OCJ7 |
| Force-add gitignored runtime | Commit policy violation |

### Scope validation (Phase 3.1.7+)

Before `completeJob`, worker compares `git diff --name-only` against allow/deny lists. Violation → `openclaw.job.stopped` + report.

---

## 8. Validation Rules

Every OpenClaw Job **must** specify non-empty `validationCommands`.

### Required validation layers

| Layer | Typical commands | Required for |
|---|---|---|
| **Syntax checks** | `node --check <file>` | Any new/modified `.js` |
| **Phase validator** | `node scripts/opportunity-engine/validate-phase-X-Y.js` | Builder, Docs (when code touched) |
| **Regression validators** | Prior phase validators listed in job | Builder per phase prompt |
| **Git status check** | Verify no `runtime/**` tracked changes | All roles |
| **Architecture boundary checks** | Grep bans: scheduler, MC imports in wrong modules | Builder, Refactor |

### Completion gate

| Outcome | Worker action |
|---|---|
| All commands exit 0 | `openclaw.job.validation_passed` → proceed to commit/report → `completeJob` |
| Any command fails | `openclaw.job.validation_failed` → `failJob` (non-retryable) → report → **STOP** |
| Skipped command | **Forbidden** — OCJ4 |

OpenClaw **cannot** mark generic Job complete without passing validation or recording failure in report + Events.

---

## 9. Commit Policy

### `commitPolicy` object

| Field | Type | Default | Description |
|---|---|---|---|
| `maxCommits` | integer | `1` | Phase-scoped atomic commits |
| `messageFormat` | string | `"Implement {phaseId} {title}"` | Template for commit message |
| `allowRuntimeCommits` | boolean | `false` | Must never be true |
| `allowForceAdd` | boolean | `false` | No `git add -f` on gitignored runtime |
| `allowEmpty` | boolean | `false` | No empty commits |

### Rules

| Rule | Detail |
|---|---|
| **C1** | One phase-scoped commit by default |
| **C2** | Message names phase and intent — imperative mood |
| **C3** | Never commit `runtime/**` JSON/JSONL stores |
| **C4** | Never commit `.env` or credentials |
| **C5** | Generated reports gitignored unless Constitution tracks them |
| **C6** | Dirty tree from unexpected files → stop before commit |
| **C7** | Failed commit → `openclaw.job.failed` → stop |

Successful commit → `openclaw.job.committed` with hash in Event payload.

---

## 10. Report Policy

### `reportPolicy` object

| Field | Type | Default | Description |
|---|---|---|---|
| `required` | boolean | `true` | Completion report mandatory |
| `pathPattern` | string | `reports/openclaw-{phaseId}-{jobId}.md` | Output path |
| `gitignored` | boolean | `true` | Matches `.gitignore` generated report policy |

### Required report sections

1. **Files created**
2. **Files modified**
3. **Commands run** (implementation + validation)
4. **Validation results** (pass/fail per command)
5. **Failures** (if any)
6. **Git status** (summary)
7. **Commit hash** (if Builder/Docs committed)
8. **Next blocked phase** (what owner must approve next)

Reports are **generated artifacts** — local unless explicitly tracked in Constitution.

Completion → `openclaw.job.reported` Event with report path in payload.

---

## 11. Stop Conditions

Hard stops — worker **must not** continue. Emit `openclaw.job.stopped` with reason code.

| Code | Condition |
|---|---|
| `phase_blocked` | `phaseId` BLOCKED in `08-current-phase.md` |
| `owner_approval_missing` | `ownerApproval` invalid or incomplete |
| `constitution_violation` | Action violates OC/OCJ rules |
| `validation_failure` | Any `validationCommands` failed |
| `unexpected_file_modification` | Diff outside `allowedFiles` |
| `failed_git_commit` | Commit rejected or hook failed |
| `ambiguous_task_scope` | Objective cannot be mapped to allowlist |
| `forbidden_action_requested` | Job requests blocked type or forbidden file |
| `external_api_unapproved` | LLM/network call not in approved job scope |
| `prompt_hash_mismatch` | Live prompt ≠ Job `promptHash` |
| `blocked_job_type` | `jobType` not allowed for current phase |
| `role_violation` | `agentRole` incompatible with `jobType` |

**Rule:** Stop always produces report + Event. No silent abort.

---

## 12. Events

OpenClaw Events append to `runtime/events/events.jsonl` via `appendEvent()`. Subject type: `openclaw_job`. Subject ID: OpenClaw Job `id`.

### Event types (Phase 3.1.6 canonical set)

| Event type | When |
|---|---|
| `openclaw.job.validated` | Pre-flight schema + approval checks passed |
| `openclaw.job.started` | After successful `claimJob` |
| `openclaw.job.files_changed` | After implementation edits (payload: file list) |
| `openclaw.job.validation_passed` | All validation commands passed |
| `openclaw.job.validation_failed` | Validation command failed |
| `openclaw.job.committed` | Git commit succeeded |
| `openclaw.job.failed` | Unrecoverable failure |
| `openclaw.job.stopped` | Hard stop condition triggered |
| `openclaw.job.reported` | Completion report written |

### Required Event payload fields

Every OpenClaw Event **must** include in `payload` or `metadata`:

| Field | Description |
|---|---|
| `jobId` | OpenClaw Job `id` |
| `phaseId` | Job phase |
| `agentRole` | Executing role |
| `correlationId` | Traces full OpenClaw session |
| `causationId` | Prior Event or Job transition ID |
| `timestamp` | Duplicates `createdAt` for payload convenience |

**Mapping note:** [29-openclaw-constitution.md](./29-openclaw-constitution.md) v1 event names (`openclaw.validation.started`, etc.) map to this set in Phase 3.1.7 implementation — prefer **§12 types** as canonical.

---

## 13. Example Jobs

### Example 1 — Builder job (Phase 3.1.7 OpenClaw CLI Worker)

```json
{
  "id": "openclaw_job_builder_317",
  "jobType": "openclaw.build",
  "phaseId": "3.1.7",
  "title": "OpenClaw CLI Worker",
  "objective": "Implement manual CLI that validates OpenClaw Job schema, claims generic Job, emits Events, and stops.",
  "ownerApproval": {
    "approvedBy": "owner",
    "approvedAt": "2026-06-23T18:00:00.000Z",
    "approvalSource": "explicit_prompt",
    "promptExcerpt": "Phase 3.1.7 — OpenClaw CLI Worker",
    "phaseDocStatus": "ACTIVE"
  },
  "agentRole": "builder",
  "scope": {
    "scopeFiles": ["scripts/openclaw/**"],
    "allowedOperations": ["create", "update"]
  },
  "constraints": {
    "architectureFreeze": true,
    "noScheduler": true,
    "noMissionControlChanges": true
  },
  "validationCommands": [
    "node --check scripts/openclaw/worker.js",
    "node scripts/opportunity-engine/validate-phase-3-1.js"
  ],
  "expectedOutputs": ["scripts/openclaw/worker.js"]
}
```

**Outcome:** Valid when Phase 3.1.7 ACTIVE + owner prompt matches `promptHash`.

---

### Example 2 — QA job (run validators only)

```json
{
  "id": "openclaw_job_qa_317",
  "jobType": "openclaw.qa",
  "phaseId": "3.1.7",
  "title": "Validate OpenClaw CLI Worker",
  "objective": "Run phase and regression validators; produce QA report; no commits.",
  "agentRole": "qa",
  "allowedFiles": [],
  "forbiddenFiles": ["**/*"],
  "validationCommands": [
    "node scripts/opportunity-engine/validate-phase-3-1.js",
    "node scripts/opportunity-engine/validate-phase-2-9-5.js --quick"
  ],
  "commitPolicy": { "maxCommits": 0 },
  "metadata": { "buildJobId": "openclaw_job_builder_317" }
}
```

**Outcome:** QA role — any file write → stop.

---

### Example 3 — Documentation job (phase docs update)

```json
{
  "id": "openclaw_job_docs_317",
  "jobType": "openclaw.docs",
  "phaseId": "3.1.7",
  "title": "Mark Phase 3.1.7 complete in Constitution",
  "objective": "Update 08, 09, 13, 15 after CLI worker validates.",
  "agentRole": "documentation",
  "allowedFiles": [
    "docs/opportunity-os/08-current-phase.md",
    "docs/opportunity-os/09-build-log.md",
    "docs/opportunity-os/13-folder-map.md",
    "docs/opportunity-os/15-api-boundaries.md"
  ],
  "forbiddenFiles": ["src/**", "scripts/**"],
  "validationCommands": [],
  "commitPolicy": { "maxCommits": 1, "messageFormat": "Document Phase 3.1.7 complete" }
}
```

**Outcome:** Valid — docs-only scope.

---

### Example 4 — Blocked connector job (must reject)

```json
{
  "id": "openclaw_job_connector_reject",
  "jobType": "openclaw.connector",
  "phaseId": "3.5",
  "title": "Live permit sensor",
  "objective": "Implement production permit feed connector.",
  "agentRole": "connector",
  "phaseId_blocked": true
}
```

**Pre-flight result:** **REJECT** — `jobType` blocked until Phase 3.5; `phaseId` BLOCKED in `08`. Emit `openclaw.job.stopped` with `blocked_job_type`. Worker never calls `claimJob`.

---

## 14. Relationship to Generic Jobs

OpenClaw Jobs are a **schema layer** on Phase 3.1 generic Jobs. Generic runtime remains **source of lifecycle truth**.

### Mapping table

| OpenClaw field | Generic Job field |
|---|---|
| `jobType` | `type` |
| `idempotencyKey` | `idempotencyKey` (top-level on generic Job) |
| `metadata.correlationId` | `metadata.correlationId` |
| Full OpenClaw schema | `metadata.openclaw` |
| `status`, `createdAt`, `updatedAt` | Generic Job fields (authoritative) |
| `outputRefs` | Generic Job — commit hashes, report paths |
| `inputRefs` | Optional — e.g. `[buildJobId]` for QA Jobs |

### `createJob` pattern (Phase 3.1.7+)

```javascript
createJob({
  type: openclawJob.jobType,
  priority: 10,
  inputRefs: openclawJob.metadata?.buildJobId ? [openclawJob.metadata.buildJobId] : [],
  idempotencyKey: openclawJob.idempotencyKey,
  metadata: {
    correlationId: openclawJob.metadata.correlationId,
    openclaw: openclawJob,
  },
});
```

**Rules:**

| Rule | Detail |
|---|---|
| **G1** | Never store OpenClaw Jobs outside `metadata.openclaw` + generic Job store |
| **G2** | Lifecycle transitions use generic API only |
| **G3** | OpenClaw Events supplement generic `job.*` Events — both emitted |
| **G4** | Worker validates `metadata.openclaw` before claim |

---

## 15. Permanent Rules (OCJ1–OCJ15)

| ID | Rule |
|---|---|
| **OCJ1** | **No job without owner approval artifact** — invalid Jobs rejected at pre-flight |
| **OCJ2** | **No job without `phaseId`** — every OpenClaw Job is phase-scoped |
| **OCJ3** | **No job without `promptHash`** — proves approved prompt origin |
| **OCJ4** | **No job without `validationCommands`** — empty list forbidden for Builder/QA |
| **OCJ5** | **No OpenClaw worker may bypass generic Job/Event runtime** — OC3 extended |
| **OCJ6** | **No worker may execute blocked job types** — pre-flight rejection required |
| **OCJ7** | **No runtime files committed** — `runtime/**` never in git commits |
| **OCJ8** | **No Constitution change without explicit job scope + owner amendment prompt** |
| **OCJ9** | **`forbiddenFiles` always overrides `allowedFiles`** |
| **OCJ10** | **QA role never commits implementation changes** |
| **OCJ11** | **Stop conditions always emit Events and reports** — no silent stop |
| **OCJ12** | **`promptHash` mismatch hard-stops** — no implement-from-stale-job |
| **OCJ13** | **One phase per Builder job** — `constraints.maxPhasesPerJob: 1` |
| **OCJ14** | **Blocked phases in `08` invalidate Jobs** — even with prompt text |
| **OCJ15** | **Completion requires report when `reportPolicy.required`** — OC5 extended |

---

## Cross-References

| Document | Relationship |
|---|---|
| [29-openclaw-constitution.md](./29-openclaw-constitution.md) | OC1–OC15; worker behavior |
| [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md) | Generic Job/Event kernel |
| [15-api-boundaries.md](./15-api-boundaries.md) | File zone ownership |
| [08-current-phase.md](./08-current-phase.md) | Phase gate for approval |
| [24-runtime-data-boundaries.md](./24-runtime-data-boundaries.md) | Gitignore / report policy |

---

## Amendment

OpenClaw Job Schema changes require [Build Log](./09-build-log.md) entry and owner sign-off. New `jobType` or `agentRole` values require OCJ review.
