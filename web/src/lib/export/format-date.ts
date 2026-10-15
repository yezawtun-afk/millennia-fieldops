// Date helpers used by the exports (kept separate so the CSV/PDF modules can
// be imported without pulling in browser-only code).
export function toDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
