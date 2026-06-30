import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFounderBriefing,
  renderFounderBriefingMarkdown,
} from "../../src/engine/founder-intent/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_MD_PATH = join(ROOT, "reports/chief-of-staff-briefing.md");
const REPORT_JSON_PATH = join(ROOT, "reports/chief-of-staff-briefing.json");

async function writeReports(briefing) {
  await mkdir(dirname(REPORT_MD_PATH), { recursive: true });
  await writeFile(REPORT_MD_PATH, renderFounderBriefingMarkdown(briefing), "utf8");
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(briefing, null, 2)}\n`, "utf8");
}

const briefing = await buildFounderBriefing();
await writeReports(briefing);

console.log("AI Chief of Staff briefing generated.");
console.log(`Active missions: ${briefing.summary.activeMissions}`);
console.log(`Opportunities: ${briefing.summary.totalOpportunities}`);
console.log(`Reports: ${REPORT_MD_PATH}, ${REPORT_JSON_PATH}`);
