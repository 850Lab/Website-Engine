#!/usr/bin/env node

import { parseArgs } from "node:util";
import * as readline from "node:readline";
import { openSync, ReadStream } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { addLead, listLeads, getTargets, updateLeadStatus, findLead } from "./leads.js";
import { LEADS_FILE } from "./storage.js";
import { parseBusinessText } from "./parse-text.js";
import { generateBrief, formatBrief } from "./brief.js";
import { generatePreviewSite } from "./preview.js";
import { generatePreviewSiteV2 } from "./preview-v2.js";
import { generatePreviewSiteV3 } from "./preview-v3.js";
import { renderPreviewV3Screenshots } from "./render-preview-v3.js";
import { generateAiAssetsForLead } from "./ai-images.js";
import { prepareAssetsForLead } from "./assets/asset-pipeline.js";
import { runDiscoverInteractive, formatDiscoverSummary } from "./discover.js";
import { cleanupTestRecords } from "./admin-tools.js";
import {
  getAutopilotStatus,
  pauseAutopilot,
  resumeAutopilot,
  runAutopilotNow,
} from "./autopilot.js";

function printUsage() {
  console.log(`
Website Outreach Engine

Usage:
  node src/cli.js add [options]
  node src/cli.js import-text
  node src/cli.js list [--status TARGET|HOLD|SKIP]
  node src/cli.js targets
  node src/cli.js update-status <id> <TARGET|HOLD|SKIP>
  node src/cli.js brief <lead-id>
  node src/cli.js generate-preview <lead-id>
  node src/cli.js generate-preview-v2 <lead-id>
  node src/cli.js generate-preview-v3 <lead-id>
  node src/cli.js render-preview-v3 <lead-id>
  node src/cli.js generate-ai-assets <lead-id>
  node src/cli.js prepare-assets <lead-id>
  node src/cli.js discover
  node src/cli.js autopilot-status
  node src/cli.js autopilot-run-now
  node src/cli.js autopilot-pause
  node src/cli.js autopilot-resume
  node src/cli.js cleanup-test-records [--dry-run] [--confirm DELETE_TEST_RECORDS]

Add options:
  --name <text>           Business name (required)
  --category <text>       Category (required)
  --city <text>           City (required)
  --phone <text>
  --website <url>
  --reviews <number>      Google review count
  --rating <number>       Google rating
  --notes <text>
  --weak-website          Site exists but is weak (+3 score)
  --service-business      Force service-business flag (+2)
  --no-service-business   Do not auto-detect service category
  --social                Active social/page evidence (+2)
  --strong-proof          Branded trucks/photos/reviews (+2)

Examples:
  node src/cli.js add --name "Joe's Plumbing" --category plumbing --city Austin --phone 512-555-0100 --reviews 24 --rating 4.6 --social --strong-proof
  node src/cli.js import-text
  node src/cli.js list
  node src/cli.js targets
  node src/cli.js update-status <uuid> HOLD
  node src/cli.js brief <uuid>
  node src/cli.js generate-preview <uuid>
  node src/cli.js generate-preview-v2 <uuid>
  node src/cli.js generate-preview-v3 <uuid>
  node src/cli.js render-preview-v3 <uuid>
  node src/cli.js generate-ai-assets <uuid>
  node src/cli.js prepare-assets <uuid>
  node src/cli.js discover
  node src/cli.js autopilot-status
  node src/cli.js autopilot-run-now
  node src/cli.js autopilot-pause
  node src/cli.js autopilot-resume
  node src/cli.js cleanup-test-records --dry-run
  node src/cli.js cleanup-test-records --confirm DELETE_TEST_RECORDS
`);
}

function formatLead(lead) {
  const lines = [
    `${lead.businessName} (${lead.city})`,
    `  id: ${lead.id}`,
    `  category: ${lead.category}`,
    `  score: ${lead.score} → ${lead.status}${lead.manualStatus ? " (manual)" : ""}`,
    `  angle: ${lead.outreachAngle}`,
    `  phone: ${lead.phone || "—"}`,
    `  website: ${lead.websiteUrl || "—"}`,
    `  reviews: ${lead.googleReviewCount} @ ${lead.googleRating || "—"}`,
  ];
  if (lead.scoreBreakdown?.length) {
    lines.push(
      `  breakdown: ${lead.scoreBreakdown.map((b) => `${b.rule} +${b.points}`).join(", ")}`
    );
  }
  if (lead.notes) lines.push(`  notes: ${lead.notes}`);
  lines.push(`  pitch: ${lead.outreachPitch}`);
  return lines.join("\n");
}

async function cmdAdd(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      name: { type: "string" },
      category: { type: "string" },
      city: { type: "string" },
      phone: { type: "string" },
      website: { type: "string" },
      reviews: { type: "string" },
      rating: { type: "string" },
      notes: { type: "string" },
      "weak-website": { type: "boolean", default: false },
      "service-business": { type: "boolean", default: false },
      "no-service-business": { type: "boolean", default: false },
      social: { type: "boolean", default: false },
      "strong-proof": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (!values.name || !values.category || !values.city) {
    console.error("Error: --name, --category, and --city are required.\n");
    printUsage();
    process.exit(1);
  }

  const lead = await addLead({
    businessName: values.name,
    category: values.category,
    city: values.city,
    phone: values.phone ?? "",
    websiteUrl: values.website ?? "",
    googleReviewCount: values.reviews ?? 0,
    googleRating: values.rating ?? 0,
    notes: values.notes ?? "",
    weakWebsite: values["weak-website"],
    serviceBusiness: values["no-service-business"]
      ? false
      : values["service-business"]
        ? true
        : undefined,
    socialEvidence: values.social,
    strongProof: values["strong-proof"],
  });

  printLeadAdded(lead);
}

function printLeadAdded(lead) {
  console.log("Lead added.\n");
  console.log(formatLead(lead));
  console.log(`\nSaved to ${LEADS_FILE}`);
}

function normalizeBusinessName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function openConsoleInput() {
  try {
    const path = process.platform === "win32" ? "CON" : "/dev/tty";
    const fd = openSync(path, "r");
    return new ReadStream(undefined, { fd });
  } catch {
    return null;
  }
}

/** Input for y/n prompts: stdin when interactive, else console TTY when stdin was piped. */
function createPromptInput() {
  if (input.isTTY) return { stream: input, ownsStream: false };
  const stream = openConsoleInput();
  return stream ? { stream, ownsStream: true } : { stream: null, ownsStream: false };
}

function parseYesNo(answer) {
  const a = String(answer ?? "").trim().toLowerCase();
  return a === "y" || a === "yes";
}

function parseWebsiteQuality(answer) {
  // Return `true` for weak, `false` for strong. If ambiguous, default to strong.
  const a = String(answer ?? "").trim().toLowerCase();
  if (!a) return false;
  if (a === "2" || a === "weak" || a.startsWith("w")) return true;
  if (a === "1" || a === "strong" || a.startsWith("s")) return false;
  return a === "2";
}

function readlineQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function askImportFollowUps({ websiteExistsOnly }) {
  const { stream, ownsStream } = createPromptInput();
  if (!stream) {
    console.warn(
      "Warning: cannot prompt for website quality/social/strong proof (no TTY). Using safe defaults.\n"
    );
    return {
      websiteWeak: false,
      socialEvidence: false,
      strongProof: false,
    };
  }

  const rl = readline.createInterface({ input: stream, output, terminal: true });
  try {
    let websiteWeak = false;
    if (websiteExistsOnly) {
      const qualityRaw = await readlineQuestion(
        rl,
        "Website quality? (1 = strong, 2 = weak) "
      );
      websiteWeak = parseWebsiteQuality(qualityRaw);
    }

    const socialRaw = await readlineQuestion(
      rl,
      "Active social/page evidence? (y/n) "
    );
    const strongRaw = await readlineQuestion(
      rl,
      "Strong proof (branded trucks/photos/reviews)? (y/n) "
    );

    return {
      websiteWeak,
      socialEvidence: parseYesNo(socialRaw),
      strongProof: parseYesNo(strongRaw),
    };
  } finally {
    rl.close();
    if (ownsStream && typeof stream.destroy === "function") {
      stream.destroy();
    }
  }
}

async function readPastedText() {
  if (!input.isTTY) {
    const chunks = [];
    for await (const chunk of input) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  const rl = readline.createInterface({ input, output });
  console.log("Paste business text below. Press Enter twice when done:\n");

  const lines = [];
  let blankLines = 0;

  return new Promise((resolve) => {
    rl.on("line", (line) => {
      if (line.trim() === "") {
        blankLines += 1;
        if (blankLines >= 2 && lines.length > 0) {
          rl.close();
          resolve(lines.join("\n"));
        }
      } else {
        blankLines = 0;
        lines.push(line);
      }
    });

    rl.on("close", () => {
      if (lines.length > 0 && blankLines < 2) {
        resolve(lines.join("\n"));
      }
    });
  });
}

async function cmdImportText() {
  const raw = await readPastedText();
  if (!raw.trim()) {
    console.error("Error: no text provided.\n");
    process.exit(1);
  }

  let fields;
  try {
    fields = parseBusinessText(raw);
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
    process.exit(1);
  }

  const leads = await listLeads();
  const incomingName = normalizeBusinessName(fields.businessName);
  const duplicate = leads.find(
    (l) => normalizeBusinessName(l.businessName) === incomingName
  );
  if (duplicate) {
    console.warn(
      `Warning: A lead with business name "${duplicate.businessName}" already exists (id: ${duplicate.id}). Import cancelled.\n`
    );
    process.exit(1);
  }

  const { websiteWeak, socialEvidence, strongProof } = await askImportFollowUps({
    websiteExistsOnly: Boolean(fields.websiteExistsOnly),
  });

  const weakWebsiteToUse =
    typeof websiteWeak === "boolean" ? websiteWeak : fields.weakWebsite;

  const lead = await addLead({
    ...fields,
    weakWebsite: weakWebsiteToUse,
    socialEvidence,
    strongProof,
  });
  printLeadAdded(lead);
}

async function cmdList(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      status: { type: "string" },
    },
    allowPositionals: false,
  });

  const leads = await listLeads(
    values.status ? { status: values.status } : {}
  );

  if (leads.length === 0) {
    console.log("No leads found.");
    return;
  }

  console.log(`${leads.length} lead(s):\n`);
  for (const lead of leads) {
    console.log(formatLead(lead));
    console.log("");
  }
}

async function cmdTargets() {
  const leads = await getTargets();
  if (leads.length === 0) {
    console.log("No TARGET leads yet.");
    return;
  }
  console.log(`${leads.length} TARGET lead(s):\n`);
  for (const lead of leads) {
    console.log(formatLead(lead));
    console.log("");
  }
}

async function cmdBrief(argv) {
  const [id, ...rest] = argv;
  if (!id || rest.length > 0) {
    console.error("Error: usage: brief <lead-id>\n");
    printUsage();
    process.exit(1);
  }

  const lead = await findLead(id);
  if (!lead) {
    console.error(`Error: Lead not found: ${id}\n`);
    process.exit(1);
  }

  const brief = generateBrief(lead);
  console.log(formatBrief(brief));
}

async function cmdGeneratePreview(argv) {
  const [id, ...rest] = argv;
  if (!id || rest.length > 0) {
    console.error("Error: usage: generate-preview <lead-id>\n");
    printUsage();
    process.exit(1);
  }

  const lead = await findLead(id);
  if (!lead) {
    console.error(`Error: Lead not found: ${id}\n`);
    process.exit(1);
  }

  const { dir, indexPath, cssPath } = await generatePreviewSite(lead);
  console.log("Preview generated.\n");
  console.log(`  Folder:  ${dir}`);
  console.log(`  HTML:    ${indexPath}`);
  console.log(`  CSS:     ${cssPath}`);
  console.log(`\nOpen in browser: file:///${indexPath.replace(/\\/g, "/")}`);
}

async function cmdGeneratePreviewV3(argv) {
  const [id, ...rest] = argv;
  if (!id || rest.length > 0) {
    console.error("Error: usage: generate-preview-v3 <lead-id>\n");
    printUsage();
    process.exit(1);
  }

  const lead = await findLead(id);
  if (!lead) {
    console.error(`Error: Lead not found: ${id}\n`);
    process.exit(1);
  }

  const { dir, indexPath, cssPath } = await generatePreviewSiteV3(lead);
  console.log("Preview v3 generated.\n");
  console.log(`  Folder:  ${dir}`);
  console.log(`  HTML:    ${indexPath}`);
  console.log(`  CSS:     ${cssPath}`);
  console.log(`\nOpen in browser: file:///${indexPath.replace(/\\/g, "/")}`);
}

async function cmdRenderPreviewV3(argv) {
  const [id, ...rest] = argv;
  if (!id || rest.length > 0) {
    console.error("Error: usage: render-preview-v3 <lead-id>\n");
    printUsage();
    process.exit(1);
  }

  const lead = await findLead(id);
  if (!lead) {
    console.error(`Error: Lead not found: ${id}\n`);
    process.exit(1);
  }

  const { slug, desktopPath, mobilePath } = await renderPreviewV3Screenshots(lead);
  const desktopRel = `renders/${slug}/desktop.png`;
  const mobileRel = `renders/${slug}/mobile.png`;

  console.log("Rendered screenshots:");
  console.log(`desktop: ${desktopRel}`);
  console.log(`mobile: ${mobileRel}`);
  console.log(`\n  ${desktopPath}`);
  console.log(`  ${mobilePath}`);
}

async function cmdGenerateAiAssets(argv) {
  const [id, ...rest] = argv;
  if (!id || rest.length > 0) {
    console.error("Error: usage: generate-ai-assets <lead-id>\n");
    printUsage();
    process.exit(1);
  }

  const lead = await findLead(id);
  if (!lead) {
    console.error(`Error: Lead not found: ${id}\n`);
    process.exit(1);
  }

  console.log(`Generating AI concept images for ${lead.businessName}…\n`);

  const { previewDir, slug, files } = await generateAiAssetsForLead(lead);

  console.log("\nAI assets generated (concept preview art — not client project photos).\n");
  console.log(`  Preview:  ${previewDir}`);
  console.log(`  hero:     previews-v3/${slug}/assets/ai/hero.jpg`);
  console.log(`  trust:    previews-v3/${slug}/assets/ai/trust.jpg`);
  console.log(`  cta:      previews-v3/${slug}/assets/ai/cta.jpg`);
  console.log("\nPreview HTML/CSS refreshed to use assets when present.");
  console.log(`\n  ${files.hero}`);
  console.log(`  ${files.trust}`);
  console.log(`  ${files.cta}`);
}

async function cmdPrepareAssets(argv) {
  const [id, ...rest] = argv;
  if (!id || rest.length > 0) {
    console.error("Error: usage: prepare-assets <lead-id>\n");
    printUsage();
    process.exit(1);
  }

  const lead = await findLead(id);
  if (!lead) {
    console.error(`Error: Lead not found: ${id}\n`);
    process.exit(1);
  }

  console.log(`Preparing assets for ${lead.businessName}…\n`);

  const { previewDir, slug, manifest, manifestPath, log } = await prepareAssetsForLead(lead);

  for (const line of log) {
    console.log(line);
  }

  console.log("\nAsset pipeline complete.\n");
  console.log(`  Source:     ${manifest.source}`);
  console.log(`  Confidence: ${manifest.confidence}`);
  console.log(`  Manifest:   previews-v3/${slug}/assets/asset-manifest.json`);
  console.log(`  Preview:    ${previewDir}`);
  if (manifest.hero) console.log(`  hero:       ${manifest.hero}`);
  if (manifest.support) console.log(`  support:    ${manifest.support}`);
  if (manifest.cta) console.log(`  cta:        ${manifest.cta}`);
  if (manifest.gallery.length) console.log(`  gallery:    ${manifest.gallery.join(", ")}`);
  console.log(`\n  ${manifestPath}`);
}

async function cmdDiscover() {
  const summary = await runDiscoverInteractive();
  console.log("\nDiscovery complete.\n");
  console.log(formatDiscoverSummary(summary));
  console.log(`\nSaved to ${LEADS_FILE}`);
}

async function cmdCleanupTestRecords(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      confirm: { type: "string" },
    },
    allowPositionals: false,
  });

  const dryRun = values["dry-run"] || values.confirm !== "DELETE_TEST_RECORDS";
  const result = await cleanupTestRecords({
    dryRun,
    confirm: values.confirm === "DELETE_TEST_RECORDS" ? "DELETE TEST RECORDS" : values.confirm,
  });

  console.log(dryRun ? "Test cleanup dry run.\n" : "Test cleanup completed.\n");
  console.log(`Matched leads: ${result.removed.leads}`);
  for (const lead of result.matches.leads) console.log(`  - ${lead.businessName} (${lead.id})`);
  console.log(`Matched Target Lead Groups: ${result.removed.leadGroups}`);
  for (const group of result.matches.leadGroups) console.log(`  - ${group.title} (${group.id})`);
  console.log(`Matched generation runs: ${result.removed.generationRuns}`);
  for (const run of result.matches.generationRuns) console.log(`  - ${run.title ?? "Untitled"} (${run.id})`);
  if (dryRun) {
    console.log('\nNo files changed. Re-run with --confirm DELETE_TEST_RECORDS to remove matched records.');
  } else {
    console.log("\nBackups created before writes:");
    for (const backup of result.backupsCreated) console.log(`  - ${backup}`);
  }
}

async function cmdAutopilotStatus() {
  const status = await getAutopilotStatus();
  console.log("Autopilot status\n");
  console.log(`Enabled: ${status.enabled}`);
  console.log(`Running: ${status.running}`);
  console.log(`Next run: ${status.nextRunAt ?? "not scheduled"}`);
  console.log(`Last run: ${status.lastRun ? `${status.lastRun.title} (${status.lastRun.status})` : "none"}`);
  console.log(`Opportunities today: ${status.opportunitiesFoundToday}`);
  console.log(`Previews today: ${status.previewsGeneratedToday}`);
  if (status.cooldownUntil) console.log(`Cooldown until: ${status.cooldownUntil}`);
  if (status.warnings.length) {
    console.log("\nWarnings:");
    for (const warning of status.warnings) console.log(`  - ${warning}`);
  }
  if (status.errorsToday.length) {
    console.log("\nErrors today:");
    for (const error of status.errorsToday) console.log(`  - ${error}`);
  }
}

async function cmdAutopilotRunNow() {
  console.log("Starting Autopilot run now...\n");
  const run = await runAutopilotNow({ source: "cli", ignoreDisabled: true });
  console.log(`${run.title}`);
  console.log(`Status: ${run.status}`);
  console.log(`Discovered: ${run.totalDiscovered}`);
  console.log(`Qualified: ${run.qualified}`);
  console.log(`Rejected: ${run.rejected}`);
  console.log(`Previews: ${run.previewsGenerated}`);
  if (run.errors?.length) {
    console.log("\nErrors:");
    for (const error of run.errors) console.log(`  - ${error}`);
  }
}

async function cmdAutopilotPause() {
  await pauseAutopilot();
  console.log("Autopilot paused.");
}

async function cmdAutopilotResume() {
  await resumeAutopilot();
  console.log("Autopilot resumed.");
}

async function cmdGeneratePreviewV2(argv) {
  const [id, ...rest] = argv;
  if (!id || rest.length > 0) {
    console.error("Error: usage: generate-preview-v2 <lead-id>\n");
    printUsage();
    process.exit(1);
  }

  const lead = await findLead(id);
  if (!lead) {
    console.error(`Error: Lead not found: ${id}\n`);
    process.exit(1);
  }

  const { dir, indexPath, cssPath } = await generatePreviewSiteV2(lead);
  console.log("Preview v2 generated.\n");
  console.log(`  Folder:  ${dir}`);
  console.log(`  HTML:    ${indexPath}`);
  console.log(`  CSS:     ${cssPath}`);
  console.log(`\nOpen in browser: file:///${indexPath.replace(/\\/g, "/")}`);
}

async function cmdUpdateStatus(argv) {
  const [id, status, ...rest] = argv;
  if (!id || !status || rest.length > 0) {
    console.error("Error: usage: update-status <id> <TARGET|HOLD|SKIP>\n");
    printUsage();
    process.exit(1);
  }

  try {
    const lead = await updateLeadStatus(id, status);
    console.log("Status updated.\n");
    console.log(formatLead(lead));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  try {
    switch (command) {
      case "add":
        await cmdAdd(rest);
        break;
      case "import-text":
        await cmdImportText();
        break;
      case "list":
        await cmdList(rest);
        break;
      case "targets":
        await cmdTargets();
        break;
      case "update-status":
        await cmdUpdateStatus(rest);
        break;
      case "brief":
        await cmdBrief(rest);
        break;
      case "generate-preview":
        await cmdGeneratePreview(rest);
        break;
      case "generate-preview-v2":
        await cmdGeneratePreviewV2(rest);
        break;
      case "generate-preview-v3":
        await cmdGeneratePreviewV3(rest);
        break;
      case "render-preview-v3":
        await cmdRenderPreviewV3(rest);
        break;
      case "generate-ai-assets":
        await cmdGenerateAiAssets(rest);
        break;
      case "prepare-assets":
        await cmdPrepareAssets(rest);
        break;
      case "discover":
        await cmdDiscover();
        break;
      case "autopilot-status":
        await cmdAutopilotStatus();
        break;
      case "autopilot-run-now":
        await cmdAutopilotRunNow();
        break;
      case "autopilot-pause":
        await cmdAutopilotPause();
        break;
      case "autopilot-resume":
        await cmdAutopilotResume();
        break;
      case "cleanup-test-records":
        await cmdCleanupTestRecords(rest);
        break;
      default:
        console.error(`Unknown command: ${command}\n`);
        printUsage();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
