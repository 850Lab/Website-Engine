export function PillBadge({ value }) {
  const key = String(value ?? "unknown").replace(/_/g, "-").toLowerCase();
  return <span className={`badge small ${key}`}>{value ?? "unknown"}</span>;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
