import { pivotalShell } from "../shell.js";

export function renderActionsPage() {
  return pivotalShell({
    title: "Actions",
    activeNav: "actions",
    bodyHtml: `
      <div class="card">
        <div class="card-label">Actions</div>
        <div class="card-value">No actions yet</div>
      </div>
    `
  });
}
