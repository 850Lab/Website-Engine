import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VALIDATOR_GRAPH } from "../../src/engine/validation/graph.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPTS_DIR = join(ROOT, "scripts/opportunity-engine");

const PHASE_BY_SCRIPT = Object.fromEntries(VALIDATOR_GRAPH.map((row) => [row.script, row.phase]));

function wrapRegressionBlock(source) {
  return source.replace(
    /(\n)(await new Promise\(\(resolve\) => setTimeout\(resolve, 1500\)\);\s*\n)([\s\S]*?)(\nif \(errors\.length\))/g,
    (match, lead, delay, body, tail) => {
      if (body.includes("shouldSkipNestedRegressions")) return match;
      if (!body.includes("regression")) return match;
      return `${lead}${delay}if (!shouldSkipNestedRegressions()) {${body}}\n${tail}`;
    },
  );
}

function wrapTryRegressionBlocks(source) {
  return source.replace(
    /(\n)(try \{\s*\n\s*await execFileAsync\([\s\S]*?regression[\s\S]*?\} catch \(error\) \{[\s\S]*?\}\s*\n)/g,
    (match) => {
      if (match.includes("shouldSkipNestedRegressions")) return match;
      return `\nif (!shouldSkipNestedRegressions()) {${match}\n}\n`;
    },
  );
}

function wrapForRegressionLoops(source) {
  return source.replace(
    /(\n)(for \(const (?:script|regression)[\s\S]*?regression[\s\S]*?\n\}\s*\n)/g,
    (match) => {
      if (match.includes("shouldSkipNestedRegressions")) return match;
      return `\nif (!shouldSkipNestedRegressions()) {${match}}\n`;
    },
  );
}

function addImports(source) {
  if (source.includes("shouldSkipNestedRegressions")) return source;
  const importLine =
    'import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";\n';
  const firstImport = source.indexOf("import ");
  if (firstImport < 0) return importLine + source;
  const lineEnd = source.indexOf("\n", firstImport);
  return `${source.slice(0, lineEnd + 1)}${importLine}${source.slice(lineEnd + 1)}`;
}

function addBootstrap(source, phase) {
  if (source.includes("bootstrapValidator(")) return source;
  const marker = "const errors = [];";
  if (!source.includes(marker)) return source;
  return source.replace(
    marker,
    `${marker}\nconst __validationStartedAt = Date.now();\nawait bootstrapValidator("${phase}");`,
  );
}

function replaceExit(source, phase) {
  if (source.includes("finalizeValidator(")) return source;

  const failPattern =
    /if \(errors\.length\) \{\s*\n\s*console\.error\(`\\nPhase [^`]+`\);\s*\n\s*process\.exit\(1\);\s*\n\}\s*\n\s*\nconsole\.log\([\s\S]*?\);\s*$/m;

  if (failPattern.test(source)) {
    return source.replace(
      failPattern,
      `await finalizeValidator({ phase: "${phase}", errors, startedAt: __validationStartedAt });\n\nconsole.log("\\nPhase ${phase} validation passed.");`,
    );
  }

  const simpleFail = /if \(errors\.length\) \{[\s\S]*?process\.exit\(1\);\s*\}/m;
  if (simpleFail.test(source)) {
    return source.replace(simpleFail, `await finalizeValidator({ phase: "${phase}", errors, startedAt: __validationStartedAt });`);
  }

  return `${source}\n\nawait finalizeValidator({ phase: "${phase}", errors, startedAt: __validationStartedAt });\n`;
}

async function patchFile(script) {
  const phase = PHASE_BY_SCRIPT[script];
  if (!phase) return false;
  const path = join(SCRIPTS_DIR, script);
  let source = await readFile(path, "utf8");
  if (source.includes("bootstrapValidator(")) return false;
  const original = source;
  source = addImports(source);
  source = addBootstrap(source, phase);
  source = wrapForRegressionLoops(source);
  source = wrapTryRegressionBlocks(source);
  source = wrapRegressionBlock(source);
  source = replaceExit(source, phase);
  if (source === original) return false;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await writeFile(path, source, "utf8");
      return true;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  return false;
}

const scripts = Object.keys(PHASE_BY_SCRIPT);
let patched = 0;
for (const script of scripts) {
  if (await patchFile(script)) {
    patched += 1;
    console.log(`patched ${script}`);
  }
}
console.log(`Patched ${patched}/${scripts.length} validators.`);
