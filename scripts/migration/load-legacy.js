import { readFile } from "node:fs/promises";
import { LEGACY_FILES } from "./paths.js";

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

export async function loadLegacyData() {
  const [
    qualifiedDoc,
    pwDoc,
    focusDoc,
    wqsDoc,
    angleDoc,
    callDoc,
  ] = await Promise.all([
    readJson(LEGACY_FILES.qualifiedBusinesses),
    readJson(LEGACY_FILES.pwLeads),
    readJson(LEGACY_FILES.outreachFocus),
    readJson(LEGACY_FILES.websiteQualityScores),
    readJson(LEGACY_FILES.angleAnalyses),
    readJson(LEGACY_FILES.callSessions),
  ]);

  return {
    qualifiedBusinesses: qualifiedDoc.records ?? [],
    pwLeads: pwDoc.leads ?? [],
    outreachFocus: focusDoc,
    websiteQualityScores: wqsDoc.scores ?? [],
    angleAnalyses: angleDoc.analyses ?? {},
    callSessions: callDoc.sessions ?? {},
  };
}
