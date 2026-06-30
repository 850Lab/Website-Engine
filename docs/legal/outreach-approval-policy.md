# Outreach Approval Policy

**Effective date:** June 30, 2026  
**Owner:** Founder — Pivotal Websites  
**Public URL:** `/legal/outreach-approval`  
**Mission:** Pressure Washing commercial — Beaumont 500-mile radius (Mission #1)

---

## Policy statement

**The Founder must approve all outreach** before it is sent or placed in an execution queue. The system may draft opportunities, contacts, copy, and sequences—but **may not send** without an explicit approval record.

This matches the active mission approval gate: `requireFounderApprovalBeforeOutreach: true`, `maxAutonomousActionsPerDay: 0`.

---

## What requires Founder approval

| Action | Approval required |
|---|---|
| First contact email to a new business | Yes |
| Bulk or sequenced email | Yes |
| Phone campaign batch (beyond normal operator queue) | Yes |
| New offer/angle not in approved mission template | Yes |
| Autonomous or scheduled sends | Yes — **disabled until explicitly re-authorized in writing** |

### Does not require separate approval (operator discretion)

- Individual click-to-call from PW queue using existing scripts
- Updating lead status, notes, outcomes in CRM
- Running lead discovery scripts (no outreach)

---

## Approval methods (until UI built)

Valid approval records include:

1. **Mission #1 activation** (2026-06-30) — establishes PW commercial scope and global outreach gate
2. **Written Founder message** (email/chat) naming the campaign or lead batch
3. **Future:** CEO review UI approval state (`N1`, `N3` — engineering)

Engineering systems must log: who approved, what was approved, timestamp, and scope (mission, opportunity IDs, or campaign ID).

---

## Rejection and pause

Founder may pause or reject any draft outreach. Rejected items must not retry without new approval.

Kill switch: disable sending provider credentials or set global outreach halt flag (future engineering).

---

## First outreach mode (decision)

**Primary path:** Phone/Twilio through PW operator queue (manual, Founder-controlled).

**Secondary path:** Email pilot only after ESP domain verification and per-batch Founder approval.

---

## Founder approval

**Approved by Founder** June 30, 2026.

**Contact:** privacy@pivotalwebsites.com
