// CSV building for the records export.
import { toDateOnly } from "./format-date";
import { TYPE_LABELS } from "../format";
import type { FieldRecord } from "../types";

const HEADERS = [
  "Title",
  "Type",
  "Zone",
  "Observed",
  "Status",
  "Severity",
  "Species / hazard / reading",
  "Health",
  "Latitude",
  "Longitude",
  "Submitted by",
  "Notes",
];

function speciesOrHazard(r: FieldRecord): string {
  if (r.type === "flora") return r.species_name || "";
  if (r.type === "hazard") return r.hazard_type || "";
  return r.reading_type || "";
}

function cell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildRecordsCsv(records: FieldRecord[]): string {
  const lines = [HEADERS.join(",")];

  for (const r of records) {
    lines.push(
      [
        r.title,
        TYPE_LABELS[r.type] ?? r.type,
        r.zone?.name ?? "",
        toDateOnly(r.observed_date),
        r.status,
        r.severity ?? "",
        speciesOrHazard(r),
        r.health_condition ?? "",
        r.latitude ?? "",
        r.longitude ?? "",
        r.submitter?.full_name ?? "",
        r.notes ?? "",
      ]
        .map(cell)
        .join(",")
    );
  }

  // Excel on Windows reads accented text correctly with a byte-order mark.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
