/** Documented sort keys for queue parity (legacy ↔ schema). */
export const WEBSITE_QUEUE_SORT_KEYS = [
  "priorityLabel rank (Hot=0, Warm=1, Nurture=2, Manual Review=3)",
  "priorityScore descending",
  "outreachStatus rank (not_contacted → lost)",
  "businessName ascending",
  "focus boost via sortLeadsByFocus when focus is set",
];

export const PW_QUEUE_SORT_KEYS = [
  "visibility tier: follow-up due, interested, estimate_needed, new, default",
  "follow-up due: nextFollowUpAt ascending",
  "new leads: discoveredAt ascending",
  "batchRank ascending",
  "priorityScore descending",
  "focus boost via sortLeadsByFocus when focus is set",
];

export const PRIORITY_RANK = { Hot: 0, Warm: 1, Nurture: 2, "Manual Review": 3 };

export const WEBSITE_OUTREACH_RANK = {
  not_contacted: 0,
  contacted: 1,
  replied: 2,
  asked_price: 3,
  appointment: 4,
  won: 5,
  lost: 6,
};

export function compareWebsiteQueueRows(a, b) {
  const pa = PRIORITY_RANK[a.priorityLabel] ?? 9;
  const pb = PRIORITY_RANK[b.priorityLabel] ?? 9;
  if (pa !== pb) return pa - pb;

  const scoreA = Number(a.priorityScore ?? a.priority) || 0;
  const scoreB = Number(b.priorityScore ?? b.priority) || 0;
  if (scoreB !== scoreA) return scoreB - scoreA;

  const oa = WEBSITE_OUTREACH_RANK[a.outreachStatus] ?? 9;
  const ob = WEBSITE_OUTREACH_RANK[b.outreachStatus] ?? 9;
  if (oa !== ob) return oa - ob;

  const nameA = a.businessName ?? a.legacyId ?? "";
  const nameB = b.businessName ?? b.legacyId ?? "";
  return String(nameA).localeCompare(String(nameB));
}

export function sortWebsiteQueueRows(rows, focus = null) {
  const sorted = [...rows].sort(compareWebsiteQueueRows);
  if (!focus) return sorted;
  return applyFocusSort(sorted, focus);
}

function pwVisibilityTier(row) {
  if (row.followUpDue || row.isFollowUpDue) return 1;
  const status = String(row.status ?? "").toLowerCase();
  if (status === "interested") return 2;
  if (status === "estimate_needed") return 3;
  if (status === "new") return 5;
  return 4;
}

export function comparePwQueueRows(a, b) {
  const ta = pwVisibilityTier(a);
  const tb = pwVisibilityTier(b);
  if (ta !== tb) return ta - tb;

  if (ta === 1) {
    return Date.parse(a.nextFollowUpAt) - Date.parse(b.nextFollowUpAt);
  }
  if (ta === 5) {
    const aDisc = Date.parse(a.discoveredAt || a.createdAt) || 0;
    const bDisc = Date.parse(b.discoveredAt || b.createdAt) || 0;
    return aDisc - bDisc;
  }

  const rankDiff = (a.batchRank || 999) - (b.batchRank || 999);
  if (rankDiff) return rankDiff;

  return (Number(b.priorityScore ?? b.priority) || 0) - (Number(a.priorityScore ?? a.priority) || 0);
}

export function sortPwQueueRows(rows, focus = null) {
  const sorted = [...rows].sort(comparePwQueueRows);
  if (!focus) return sorted;
  return applyFocusSort(sorted, focus);
}

function applyFocusSort(rows, focus) {
  return import("../outreach-focus/store.js").then(({ sortLeadsByFocus }) =>
    sortLeadsByFocus(rows, focus),
  );
}

export async function sortWebsiteQueueRowsAsync(rows, focus = null) {
  const sorted = [...rows].sort(compareWebsiteQueueRows);
  if (!focus) return sorted;
  const { sortLeadsByFocus } = await import("../outreach-focus/store.js");
  return sortLeadsByFocus(sorted, focus);
}

export async function sortPwQueueRowsAsync(rows, focus = null) {
  const sorted = [...rows].sort(comparePwQueueRows);
  if (!focus) return sorted;
  const { sortLeadsByFocus } = await import("../outreach-focus/store.js");
  return sortLeadsByFocus(sorted, focus);
}
