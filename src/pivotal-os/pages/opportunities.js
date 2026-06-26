import { pivotalShell } from "../shell.js";

export function renderOpportunitiesPage() {
  return pivotalShell({
    title: "Opportunities",
    activeNav: "opportunities",
    bodyHtml: `
      <div class="card">
        <div class="card-label">Opportunities</div>
        <div class="card-value">No opportunities yet</div>
      </div>
    `
  });
}
