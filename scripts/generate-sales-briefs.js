import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSalesBriefMarkdown } from "../src/sales-brief/industry-rules.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCREENSHOTS_ROOT = join(ROOT, "data", "website-screenshots");

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadBusinessJson(folderPath) {
  const businessPath = join(folderPath, "business.json");
  if (!(await fileExists(businessPath))) {
    throw new Error("business.json not found");
  }
  return JSON.parse(await readFile(businessPath, "utf8"));
}

async function listScreenshotFolders() {
  const entries = await readdir(SCREENSHOTS_ROOT, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function generateBriefForFolder(folderName) {
  const folderPath = join(SCREENSHOTS_ROOT, folderName);
  const business = await loadBusinessJson(folderPath);
  const brief = buildSalesBriefMarkdown(business);
  const outputPath = join(folderPath, "sales-brief.md");
  await writeFile(outputPath, brief, "utf8");
  return outputPath;
}

async function main() {
  const folders = await listScreenshotFolders();
  let generated = 0;
  const failures = [];

  console.log(`Generating sales briefs for ${folders.length} folders...`);

  for (const folderName of folders.sort()) {
    try {
      const outputPath = await generateBriefForFolder(folderName);
      generated += 1;
      console.log(`  ✓ ${folderName}`);
    } catch (err) {
      failures.push({ folderName, error: err.message });
      console.log(`  ✗ ${folderName}: ${err.message}`);
    }
  }

  console.log(`\nDone. Generated ${generated} sales briefs.`);
  if (failures.length) {
    console.log(`Skipped/failed: ${failures.length}`);
    for (const failure of failures) {
      console.log(`  - ${failure.folderName}: ${failure.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
