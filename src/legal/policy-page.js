import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function markdownToHtml(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const parts = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }
    if (trimmed === "---") {
      closeList();
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeList();
      parts.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      parts.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      parts.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("- ")) {
      if (!inList) {
        parts.push("<ul>");
        inList = true;
      }
      parts.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
      continue;
    }

    closeList();
    parts.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  closeList();
  return parts.join("\n");
}

export async function renderLegalPolicyPage(options = {}) {
  const relativePath = options.relativePath || "docs/legal/privacy-policy.md";
  const pageTitle = options.pageTitle || "Policy";
  const homeUrl = escapeHtml(options.homeUrl || "/");
  const markdown = await readFile(join(ROOT, relativePath), "utf8");
  const bodyHtml = markdownToHtml(markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)} — Pivotal Websites</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f8fc;
      --panel: #ffffff;
      --text: #152033;
      --muted: #5b677a;
      --border: #d8e0ec;
      --accent: #2563eb;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    body { margin: 0; background: var(--bg); color: var(--text); }
    .wrap { max-width: 760px; margin: 0 auto; padding: 32px 20px 56px; }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px 24px;
      box-shadow: 0 10px 30px rgba(21, 32, 51, 0.06);
    }
    h1 { font-size: 2rem; line-height: 1.15; margin: 0 0 12px; }
    h2 { font-size: 1.2rem; margin: 28px 0 10px; }
    h3 { font-size: 1rem; margin: 20px 0 8px; }
    p, li { color: var(--muted); line-height: 1.65; }
    ul { padding-left: 1.2rem; }
    .back { display: inline-block; margin-bottom: 18px; color: var(--accent); text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    <a class="back" href="${homeUrl}">← Back</a>
    <div class="card">${bodyHtml}</div>
  </div>
</body>
</html>`;
}
