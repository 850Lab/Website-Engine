import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

export const FIELD_TEST_FILE = join(DATA_DIR, "field-test-results.json");

const SLOT_COUNT = 3;
const OUTCOMES = ["no_response", "replied", "interested", "meeting_booked", "rejected"];

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function inferContactPaths(slot) {
  const paths = [];
  if (cleanText(slot.leadInput?.phone)) paths.push("phone");
  if (cleanText(slot.leadInput?.email)) paths.push("email");
  if (cleanText(slot.leadInput?.websiteUrl)) paths.push("website");
  if (cleanText(slot.leadInput?.social)) paths.push("social");
  return paths;
}

function slotReadyToContact(slot) {
  return (
    slot.steps.demoGeneration.status === "passed" &&
    slot.steps.outreachPreparation.status === "passed" &&
    inferContactPaths(slot).length > 0
  );
}

function emptyStep() {
  return {
    status: "pending",
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    retries: 0,
    errors: [],
  };
}

function emptySlot(index) {
  return {
    slotNumber: index,
    label: `Business ${index}`,
    leadId: null,
    leadInput: {
      businessName: "",
      niche: "",
      websiteUrl: "",
      phone: "",
      email: "",
      social: "",
      city: "",
    },
    steps: {
      leadCreation: emptyStep(),
      demoGeneration: emptyStep(),
      outreachPreparation: emptyStep(),
      outreachExecution: emptyStep(),
      outcomeTracking: emptyStep(),
    },
    outreach: {
      subject: "",
      body: "",
      pitchScript: "",
      objectionHandling: [],
      followUpScripts: [],
      closeCta: "",
    },
    execution: {
      contacted: false,
      contactMethod: "",
      contactedAt: null,
      followUpNeeded: false,
      nextFollowUpAt: null,
    },
    outcome: {
      status: "",
      notes: "",
      recordedAt: null,
    },
    failures: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function defaultState() {
  return {
    id: "field_test_current",
    startedAt: nowIso(),
    updatedAt: nowIso(),
    slots: Array.from({ length: SLOT_COUNT }, (_, index) => emptySlot(index + 1)),
  };
}

function normalizeSlot(slot, index) {
  const base = emptySlot(index);
  return {
    ...base,
    ...slot,
    slotNumber: index,
    label: `Business ${index}`,
    leadInput: { ...base.leadInput, ...(slot?.leadInput ?? {}) },
    steps: {
      leadCreation: { ...base.steps.leadCreation, ...(slot?.steps?.leadCreation ?? {}) },
      demoGeneration: { ...base.steps.demoGeneration, ...(slot?.steps?.demoGeneration ?? {}) },
      outreachPreparation: { ...base.steps.outreachPreparation, ...(slot?.steps?.outreachPreparation ?? {}) },
      outreachExecution: { ...base.steps.outreachExecution, ...(slot?.steps?.outreachExecution ?? {}) },
      outcomeTracking: { ...base.steps.outcomeTracking, ...(slot?.steps?.outcomeTracking ?? {}) },
    },
    outreach: { ...base.outreach, ...(slot?.outreach ?? {}) },
    execution: { ...base.execution, ...(slot?.execution ?? {}) },
    outcome: { ...base.outcome, ...(slot?.outcome ?? {}) },
    failures: Array.isArray(slot?.failures) ? slot.failures : [],
  };
}

function normalizeState(input) {
  const base = defaultState();
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) =>
    normalizeSlot(input?.slots?.[index], index + 1)
  );
  return {
    ...base,
    ...input,
    slots,
    updatedAt: input?.updatedAt ?? base.updatedAt,
  };
}

export async function readFieldTestState() {
  try {
    return normalizeState(JSON.parse(await readFile(FIELD_TEST_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return defaultState();
    throw err;
  }
}

async function writeFieldTestState(state) {
  const next = normalizeState({ ...state, updatedAt: nowIso() });
  await writeJsonFileSafe(FIELD_TEST_FILE, next);
  return next;
}

export async function resetFieldTestState() {
  return writeFieldTestState(defaultState());
}

async function updateSlot(slotNumber, updater) {
  const state = await readFieldTestState();
  const index = Number(slotNumber) - 1;
  if (index < 0 || index >= SLOT_COUNT) throw new Error("Field test slot must be 1, 2, or 3.");
  const slot = normalizeSlot(state.slots[index], index + 1);
  state.slots[index] = normalizeSlot(await updater(slot), index + 1);
  return writeFieldTestState(state);
}

function passStep(step, extra = {}) {
  return {
    ...step,
    ...extra,
    status: "passed",
    completedAt: nowIso(),
  };
}

function failStep(step, error, extra = {}) {
  return {
    ...step,
    ...extra,
    status: "failed",
    completedAt: nowIso(),
    errors: [...(step.errors ?? []), cleanText(error)].filter(Boolean),
  };
}

export async function recordFieldTestLead(slotNumber, lead, input) {
  return updateSlot(slotNumber, (slot) => {
    const hasContact = Boolean(
      cleanText(lead.phone) ||
        cleanText(input?.email) ||
        cleanText(lead.websiteUrl) ||
        cleanText(input?.social)
    );
    const failures = hasContact
      ? slot.failures
      : [
          ...slot.failures,
          {
            at: nowIso(),
            category: "Traffic",
            message: "Lead saved, but no phone/email/social contact path was provided.",
          },
        ];
    return {
      ...slot,
      leadId: lead.id,
      leadInput: {
        ...slot.leadInput,
        businessName: lead.businessName,
        niche: lead.category,
        websiteUrl: lead.websiteUrl,
        phone: lead.phone,
        email: cleanText(input?.email),
        social: cleanText(input?.social),
        city: lead.city,
      },
      steps: {
        ...slot.steps,
        leadCreation: passStep(slot.steps.leadCreation),
      },
      failures,
      updatedAt: nowIso(),
    };
  });
}

export async function recordFieldTestDemo(slotNumber, result) {
  return updateSlot(slotNumber, (slot) => {
    const durationMs = Number(result.durationMs) || 0;
    const error = cleanText(result.error);
    const passed = Boolean(result.previewExists);
    return {
      ...slot,
      steps: {
        ...slot.steps,
        demoGeneration: passed
          ? passStep(slot.steps.demoGeneration, {
              durationMs,
              retries: Number(slot.steps.demoGeneration.retries) || 0,
            })
          : failStep(slot.steps.demoGeneration, error || "Preview did not exist after generation.", {
              durationMs,
              retries: (Number(slot.steps.demoGeneration.retries) || 0) + 1,
            }),
      },
      failures: passed
        ? slot.failures
        : [
            ...slot.failures,
            {
              at: nowIso(),
              category: "System",
              message: error || "Demo generation failed or produced no usable preview.",
            },
          ],
      updatedAt: nowIso(),
    };
  });
}

export async function recordFieldTestOutreachPrep(slotNumber, outreach) {
  return updateSlot(slotNumber, (slot) => {
    const missing = [];
    if (!cleanText(outreach.subject)) missing.push("subject");
    if (!cleanText(outreach.body)) missing.push("message body");
    if (!cleanText(outreach.pitchScript)) missing.push("pitch script");
    if (!cleanText(outreach.closeCta)) missing.push("CTA");
    const passed = missing.length === 0;
    return {
      ...slot,
      outreach: {
        subject: outreach.subject,
        body: outreach.body,
        pitchScript: outreach.pitchScript,
        objectionHandling: outreach.objectionHandling ?? [],
        followUpScripts: outreach.followUpScripts ?? [],
        closeCta: outreach.closeCta,
      },
      steps: {
        ...slot.steps,
        outreachPreparation: passed
          ? passStep(slot.steps.outreachPreparation)
          : failStep(slot.steps.outreachPreparation, `Missing outreach assets: ${missing.join(", ")}`),
      },
      failures: passed
        ? slot.failures
        : [
            ...slot.failures,
            {
              at: nowIso(),
              category: "Skill",
              message: `Outreach preparation was incomplete: ${missing.join(", ")}.`,
            },
          ],
      updatedAt: nowIso(),
    };
  });
}

export async function recordFieldTestExecution(slotNumber, execution) {
  return updateSlot(slotNumber, (slot) => {
    const contactMethod = cleanText(execution.contactMethod);
    const contacted = Boolean(execution.contacted);
    const passed = contacted && Boolean(contactMethod);
    return {
      ...slot,
      execution: {
        contacted,
        contactMethod,
        contactedAt: execution.contactedAt ?? nowIso(),
        followUpNeeded: Boolean(execution.followUpNeeded),
        nextFollowUpAt: execution.nextFollowUpAt ?? null,
      },
      steps: {
        ...slot.steps,
        outreachExecution: passed
          ? passStep(slot.steps.outreachExecution)
          : failStep(slot.steps.outreachExecution, "Outreach was not completed or contact method was missing."),
      },
      failures: passed
        ? slot.failures
        : [
            ...slot.failures,
            {
              at: nowIso(),
              category: contactMethod ? "Skill" : "Traffic",
              message: contactMethod
                ? "User stopped before contacting the business."
                : "No contact method was available or selected.",
            },
          ],
      updatedAt: nowIso(),
    };
  });
}

export async function recordFieldTestOutcome(slotNumber, outcome) {
  return updateSlot(slotNumber, (slot) => {
    const status = OUTCOMES.includes(outcome.status) ? outcome.status : "no_response";
    return {
      ...slot,
      outcome: {
        status,
        notes: cleanText(outcome.notes),
        recordedAt: nowIso(),
      },
      steps: {
        ...slot.steps,
        outcomeTracking: passStep(slot.steps.outcomeTracking),
      },
      updatedAt: nowIso(),
    };
  });
}

function slotComplete(slot) {
  return (
    slot.steps.demoGeneration.status === "passed" &&
    slot.steps.outreachPreparation.status === "passed" &&
    slot.steps.outreachExecution.status === "passed" &&
    slot.steps.outcomeTracking.status === "passed"
  );
}

function analyzeBottleneck(slots) {
  const evidence = [];
  const counts = { Traffic: 0, System: 0, Skill: 0 };
  for (const slot of slots) {
    for (const failure of slot.failures) {
      if (counts[failure.category] !== undefined) {
        counts[failure.category] += 1;
        evidence.push(`${slot.label}: ${failure.message}`);
      }
    }
    if (slot.steps.leadCreation.status === "pending") {
      counts.Traffic += 1;
      evidence.push(`${slot.label}: no valid lead selected or created yet.`);
    }
    if (slot.steps.leadCreation.status === "passed" && slot.steps.demoGeneration.status === "failed") {
      counts.System += 1;
    }
    if (slot.steps.outreachPreparation.status === "passed" && slot.steps.outreachExecution.status !== "passed") {
      counts.Skill += 1;
      evidence.push(`${slot.label}: outreach is prepared but not executed.`);
    }
    if (slot.outcome.status === "no_response") {
      counts.Traffic += 1;
      evidence.push(`${slot.label}: outreach completed but no response recorded.`);
    }
    if (["replied", "interested"].includes(slot.outcome.status)) {
      counts.Skill += 1;
      evidence.push(`${slot.label}: positive reply needs conversion into a booked meeting.`);
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][1] > 0 ? sorted[0][0] : "None";
  const suggestions = {
    Traffic: "Improve lead selection and contact paths before building more demos.",
    System: "Stabilize preview/assets/render flow before scaling outreach.",
    Skill: "Tighten pitch, CTA, objection handling, and follow-up execution.",
    None: "Keep executing the three slots; no dominant bottleneck yet.",
  };
  return {
    primary,
    counts,
    evidence: evidence.slice(0, 8),
    suggestedNextImprovement: suggestions[primary],
  };
}

export function buildFieldTestView(state) {
  const normalized = normalizeState(state);
  const slots = normalized.slots.map((slot) => {
    const contactPaths = inferContactPaths(slot);
    return {
      ...slot,
      contactPaths,
      contactPathWarning: contactPaths.length
        ? ""
        : "No phone, email, website, or social/contact path is saved for this lead.",
      readyToContact: slotReadyToContact(slot),
      customImageHelpNeeded:
        slot.steps.demoGeneration.status === "failed" ||
        (slot.steps.demoGeneration.status === "passed" && slot.steps.demoGeneration.errors?.length > 0),
    };
  });
  const completeSlots = slots.filter(slotComplete).length;
  const stats = slots.reduce(
    (total, slot) => {
      if (slot.steps.demoGeneration.status === "passed") total.demosGenerated += 1;
      if (slot.steps.outreachExecution.status === "passed") total.outreachSent += 1;
      if (["replied", "interested", "meeting_booked"].includes(slot.outcome.status)) total.repliesReceived += 1;
      if (slot.outcome.status === "meeting_booked") total.meetingsBooked += 1;
      total.failures += slot.failures.length;
      return total;
    },
    { demosGenerated: 0, outreachSent: 0, repliesReceived: 0, meetingsBooked: 0, failures: 0 }
  );
  const bottleneck = analyzeBottleneck(slots);
  const allComplete = completeSlots === SLOT_COUNT;
  const nextSlot = slots.find((slot) => !slotComplete(slot));
  const nextAction = nextSlot
    ? `${nextSlot.label}: ${
        nextSlot.steps.leadCreation.status !== "passed"
          ? "create or save the lead"
          : nextSlot.steps.demoGeneration.status !== "passed"
            ? "generate a usable demo preview"
            : nextSlot.steps.outreachPreparation.status !== "passed"
              ? "prepare outreach and sales scripts"
              : nextSlot.steps.outreachExecution.status !== "passed"
                ? "contact the business"
                : "record the outcome"
      }`
    : "Review the final field test report.";

  return {
    ...normalized,
    slots,
    progress: {
      complete: completeSlots,
      total: SLOT_COUNT,
      percent: Math.round((completeSlots / SLOT_COUNT) * 100),
    },
    status: allComplete ? (stats.demosGenerated === 3 && stats.outreachSent === 3 ? "PASS" : "FAIL") : "IN_PROGRESS",
    stats,
    bottleneck,
    nextRecommendedAction: nextAction,
    finalReport: allComplete
      ? {
          pass: stats.demosGenerated === 3 && stats.outreachSent === 3,
          summary: `Completed ${completeSlots}/3 businesses with ${stats.demosGenerated} demos, ${stats.outreachSent} outreach attempts, ${stats.repliesReceived} replies, and ${stats.meetingsBooked} meetings/bookings.`,
          bottleneck,
          recommendations: [
            bottleneck.suggestedNextImprovement,
            stats.meetingsBooked > 0
              ? "Use the booked-meeting path as the next repeatable playbook."
              : "Run another 3-business test after improving the primary bottleneck.",
          ],
          exportText: [
            "3-Business Field Test Report",
            `Result: ${stats.demosGenerated === 3 && stats.outreachSent === 3 ? "PASS" : "FAIL"}`,
            `Businesses tested: ${slots.map((slot) => slot.leadInput.businessName || slot.label).join(", ")}`,
            `Primary bottleneck: ${bottleneck.primary}`,
            `Evidence: ${bottleneck.evidence.length ? bottleneck.evidence.join(" | ") : "No bottleneck evidence recorded."}`,
            `Next recommended action: ${nextAction}`,
            `Stats: ${stats.demosGenerated} demos, ${stats.outreachSent} outreach sent, ${stats.repliesReceived} replies, ${stats.meetingsBooked} meetings/bookings, ${stats.failures} failures.`,
          ].join("\n"),
        }
      : null,
  };
}
