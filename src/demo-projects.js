import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";
import { buildOutreachDraft } from "./mission-control.js";
import { buildSalesSupportForLead } from "./sales-support.js";

export const DEMO_PROJECTS_FILE = join(DATA_DIR, "demo-projects.json");

function cleanText(value) {
  return String(value ?? "").trim();
}

async function readProjects() {
  try {
    const parsed = JSON.parse(await readFile(DEMO_PROJECTS_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeProjects(projects) {
  await writeJsonFileSafe(DEMO_PROJECTS_FILE, projects);
}

function projectIdForLead(lead) {
  return `demo_${lead.id}`;
}

export function buildDemoProjectFromLead(lead) {
  const draft = buildOutreachDraft(lead);
  const sales = buildSalesSupportForLead(lead);
  return {
    id: projectIdForLead(lead),
    leadId: lead.id,
    businessName: lead.businessName,
    city: lead.city,
    category: lead.category,
    score: Number(lead.score) || 0,
    status: "ready_for_review",
    previewStatus: lead.previewStatus ?? "not_generated",
    previewUrl: lead.preview?.previewUrl ?? null,
    desktopRenderUrl: lead.preview?.desktopRenderUrl ?? null,
    mobileRenderUrl: lead.preview?.mobileRenderUrl ?? null,
    outreachSubject: draft.subject,
    outreachBody: draft.body,
    offerFraming: sales.offerFraming,
    pitchScript: sales.pitchScript,
    objectionHandling: sales.objectionHandling,
    followUpScripts: sales.followUpScripts,
    closeCta: sales.closeCta,
    contacted: ["contacted", "replied", "won", "lost"].includes(lead.pipelineStage) ||
      ["contacted", "replied", "no_response", "won", "lost"].includes(lead.replyStatus),
    replyStatus: lead.replyStatus ?? "not_contacted",
    pipelineStage: lead.pipelineStage ?? "new",
    notes: cleanText(lead.notes),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveDemoProjectForLead(lead) {
  const projects = await readProjects();
  const nextProject = buildDemoProjectFromLead(lead);
  const index = projects.findIndex((project) => project.id === nextProject.id);
  if (index === -1) {
    projects.push(nextProject);
  } else {
    projects[index] = {
      ...projects[index],
      ...nextProject,
      createdAt: projects[index].createdAt ?? nextProject.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }
  await writeProjects(projects);
  return index === -1 ? nextProject : projects[index];
}

export async function listDemoProjects() {
  const projects = await readProjects();
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
