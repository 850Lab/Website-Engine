#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { useSchemaOutcomeWrites } from "../src/services/feature-flags.js";
import { getSchemaWriteSnapshot } from "../src/services/schema-outcomes/record-write.js";
import {
  recordWebsiteOutcomeWrite,
  recordWebsiteNoteWrite,
  recordPwStatusWrite,
  recordPwNoteWrite,
} from "../src/services/schema-outcomes/record-write.js";
import { buildSchemaSalesQueue } from "../src/services/schema-queue/website-queue-read.js";
import { buildSchemaPwQueueLeads } from "../src/services/schema-queue/pw-queue-read.js";
import { getFocus } from "../src/outreach-focus/store.js";
import { OUTREACH_STATUS_LABELS } from "../src/outreach-page.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "data", "migration", "outcome-writes");

function mockRequest() {
  return {
    protocol: "http",
    headers: { host: "localhost" },
    get(name) {
      return name.toLowerCase() === "host" ? "localhost" : undefined;
    },
  };
}

function assertLegacyOutcomeShape(result) {
  const keys = Object.keys(result ?? {}).sort();
  const expected = ["id", "outreachStatus", "outreachStatusLabel"].sort();
  return {
    pass: JSON.stringify(keys) === JSON.stringify(expected),
    keys,
    expected,
  };
}

async function pickWebsiteLegacyId() {
  const queue = await buildSchemaSalesQueue(mockRequest(), {
    focusOnly: true,
    phoneOnly: true,
    excludeTwilioTest: true,
    excludeClosed: false,
  });
  return queue[0]?.id ?? null;
}

async function pickPwLegacyId() {
  const focus = await getFocus("pressure-washing").catch(() => null);
  const queue = await buildSchemaPwQueueLeads(focus);
  return queue[0]?.id ?? null;
}

async function validateWebsiteOutcomeWrite(legacyId) {
  const before = await getSchemaWriteSnapshot(legacyId, "website");
  const first = await recordWebsiteOutcomeWrite({
    legacyId,
    status: "contacted",
    operator: { id: "validation_operator", name: "Validation Operator" },
  });
  const afterFirst = await getSchemaWriteSnapshot(legacyId, "website");
  const second = await recordWebsiteOutcomeWrite({
    legacyId,
    status: "contacted",
    operator: { id: "validation_operator", name: "Validation Operator" },
  });
  const afterSecond = await getSchemaWriteSnapshot(legacyId, "website");

  const legacyShape = assertLegacyOutcomeShape({
    id: legacyId,
    outreachStatus: "contacted",
    outreachStatusLabel: OUTREACH_STATUS_LABELS.contacted,
  });

  return {
    legacyId,
    before,
    afterFirst,
    afterSecond,
    first,
    second,
    checks: {
      attemptIncreased: afterFirst.attemptCount === before.attemptCount + 1,
      noDuplicateOnRepeat:
        afterSecond.attemptCount === afterFirst.attemptCount && second?.duplicateAttempt === true,
      opportunityUpdated: afterFirst.outreachStatus === "contacted",
      queueItemUpdated: afterFirst.queueState === "active",
      legacyResponseShape: legacyShape.pass,
    },
  };
}

async function validateWebsiteNoteWrite(legacyId) {
  const before = await getSchemaWriteSnapshot(legacyId, "website");
  const noteText = `validation note ${Date.now()}`;
  const first = await recordWebsiteNoteWrite({
    legacyId,
    text: noteText,
    operator: { id: "validation_operator", name: "Validation Operator" },
  });
  const afterFirst = await getSchemaWriteSnapshot(legacyId, "website");
  const second = await recordWebsiteNoteWrite({
    legacyId,
    text: noteText,
    operator: { id: "validation_operator", name: "Validation Operator" },
  });
  const afterSecond = await getSchemaWriteSnapshot(legacyId, "website");

  return {
    legacyId,
    checks: {
      attemptIncreased: afterFirst.attemptCount === before.attemptCount + 1,
      noDuplicateOnRepeat:
        afterSecond.attemptCount === afterFirst.attemptCount && second?.duplicateAttempt === true,
      opportunityUnchanged: afterFirst.outreachStatus === before.outreachStatus,
    },
    first,
    second,
  };
}

async function validatePwStatusWrite(legacyId) {
  const before = await getSchemaWriteSnapshot(legacyId, "pressure-washing");
  const first = await recordPwStatusWrite({
    legacyId,
    patch: { actionId: "called", status: "called", callAttempts: 1 },
  });
  const afterFirst = await getSchemaWriteSnapshot(legacyId, "pressure-washing");
  const second = await recordPwStatusWrite({
    legacyId,
    patch: { actionId: "called", status: "called", callAttempts: 1 },
  });
  const afterSecond = await getSchemaWriteSnapshot(legacyId, "pressure-washing");

  return {
    legacyId,
    checks: {
      attemptIncreased: afterFirst.attemptCount === before.attemptCount + 1,
      noDuplicateOnRepeat:
        afterSecond.attemptCount === afterFirst.attemptCount && second?.duplicateAttempt === true,
      opportunityUpdated: afterFirst.outreachStatus === "called",
      queueItemUpdated: afterFirst.queueState === "active",
    },
    first,
    second,
  };
}

async function validatePwNoteWrite(legacyId) {
  const before = await getSchemaWriteSnapshot(legacyId, "pressure-washing");
  const noteText = `pw validation note ${Date.now()}`;
  const first = await recordPwNoteWrite({ legacyId, text: noteText, kind: "notes" });
  const afterFirst = await getSchemaWriteSnapshot(legacyId, "pressure-washing");
  const second = await recordPwNoteWrite({ legacyId, text: noteText, kind: "notes" });
  const afterSecond = await getSchemaWriteSnapshot(legacyId, "pressure-washing");

  return {
    legacyId,
    checks: {
      attemptIncreased: afterFirst.attemptCount === before.attemptCount + 1,
      noDuplicateOnRepeat:
        afterSecond.attemptCount === afterFirst.attemptCount && second?.duplicateAttempt === true,
    },
    first,
    second,
  };
}

async function main() {
  if (!useSchemaOutcomeWrites()) {
    console.error("Set USE_SCHEMA_OUTCOME_WRITES=1 before running outcome write validation.");
    process.exit(1);
  }

  const websiteLegacyId = await pickWebsiteLegacyId();
  const pwLegacyId = await pickPwLegacyId();

  const report = {
    generatedAt: new Date().toISOString(),
    useSchemaOutcomeWrites: true,
    legacyDualWrite: true,
    websiteLegacyId,
    pwLegacyId,
    websiteOutcome: websiteLegacyId ? await validateWebsiteOutcomeWrite(websiteLegacyId) : null,
    websiteNote: websiteLegacyId ? await validateWebsiteNoteWrite(websiteLegacyId) : null,
    pwStatus: pwLegacyId ? await validatePwStatusWrite(pwLegacyId) : null,
    pwNote: pwLegacyId ? await validatePwNoteWrite(pwLegacyId) : null,
  };

  const allChecks = [
    ...(report.websiteOutcome ? Object.values(report.websiteOutcome.checks) : []),
    ...(report.websiteNote ? Object.values(report.websiteNote.checks) : []),
    ...(report.pwStatus ? Object.values(report.pwStatus.checks) : []),
    ...(report.pwNote ? Object.values(report.pwNote.checks) : []),
  ];
  report.summary = {
    totalChecks: allChecks.length,
    passed: allChecks.filter(Boolean).length,
    failed: allChecks.filter((value) => !value).length,
    ready: allChecks.every(Boolean),
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const reportPath = join(OUTPUT_DIR, "validation-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Outcome write validation summary");
  console.log("──────────────────────────────");
  console.log(`Website legacy id: ${websiteLegacyId ?? "none"}`);
  console.log(`PW legacy id: ${pwLegacyId ?? "none"}`);
  console.log(`Checks passed: ${report.summary.passed}/${report.summary.totalChecks}`);
  console.log(`Report: ${reportPath}`);

  process.exit(report.summary.ready ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
