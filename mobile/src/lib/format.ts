import type { Palette } from "../theme";
import { READING_DEFINITIONS } from "./measurements";
import type {
  HazardSeverity,
  RecordStatus,
  RecordType,
  RemediationPriority,
  UserRole,
} from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  field_worker: "Field worker",
  supervisor: "Supervisor",
  admin: "Administrator",
};

export const TYPE_LABELS: Record<RecordType, string> = {
  flora: "Flora",
  soil_water: "Soil/Water",
  hazard: "Hazard",
};

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export const SEVERITY_LABELS: Record<HazardSeverity, string> = {
  low: "Low",
  medium: "Medium",
  critical: "Critical",
};

// The tint pairs below carry colour, so they are built from whichever palette
// is active. `useTheme()` calls these once per theme change and hands the result
// to components as `tones`.
export interface TintPair {
  fg: string;
  bg: string;
}

export function typeTones(colors: Palette): Record<RecordType, TintPair> {
  return {
    flora: { fg: colors.flora, bg: colors.floraSoft },
    soil_water: { fg: colors.water, bg: colors.waterSoft },
    hazard: { fg: colors.hazard, bg: colors.hazardSoft },
  };
}

export function statusTones(colors: Palette): Record<RecordStatus, TintPair> {
  return {
    pending: { fg: colors.pendingInk, bg: colors.pendingSoft },
    approved: { fg: colors.approvedInk, bg: colors.approvedSoft },
    rejected: { fg: colors.rejectedInk, bg: colors.rejectedSoft },
  };
}

export function severityTones(colors: Palette): Record<HazardSeverity, TintPair> {
  return {
    low: { fg: colors.sevLow, bg: colors.sevLowSoft },
    medium: { fg: colors.sevMedium, bg: colors.sevMediumSoft },
    critical: { fg: colors.sevCritical, bg: colors.sevCriticalSoft },
  };
}

// Work-order priority. It follows severity by default, but a supervisor can
// raise it, so it gets its own labels rather than reusing the severity words.
export const PRIORITY_LABELS: Record<RemediationPriority, string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

export function priorityTones(colors: Palette): Record<RemediationPriority, TintPair> {
  return {
    low: { fg: colors.muted, bg: colors.panel },
    medium: { fg: colors.sevMedium, bg: colors.sevMediumSoft },
    high: { fg: colors.sevCritical, bg: colors.sevCriticalSoft },
  };
}

/** The four tint maps, ready to index by type/status/severity/priority. */
export interface Tones {
  type: Record<RecordType, TintPair>;
  status: Record<RecordStatus, TintPair>;
  severity: Record<HazardSeverity, TintPair>;
  priority: Record<RemediationPriority, TintPair>;
}

export function makeTones(colors: Palette): Tones {
  return {
    type: typeTones(colors),
    status: statusTones(colors),
    severity: severityTones(colors),
    priority: priorityTones(colors),
  };
}

// Dropdown options for the capture form.
export const GROWTH_STAGES = ["Seedling", "Sapling", "Mature"];
export const HEALTH_CONDITIONS = ["Healthy", "Stressed", "Diseased", "Dying", "Dead"];
export const HAZARD_TYPES = [
  "Fallen debris",
  "Eroded ground",
  "Blocked drainage",
  "Silt runoff",
  "Rockfall risk",
];
export const READING_TYPES = Object.keys(READING_DEFINITIONS);

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// The repair loop
//
// assigned -> fixed -> closed. Only a closed job leaves the health score, so the
// phone must show the difference between "I finished" and "a supervisor agreed".
// ---------------------------------------------------------------------------

export type WorkStage = "unassigned" | "assigned" | "verify" | "closed" | "none";

export function workStage(record: {
  type: RecordType;
  status: RecordStatus;
  assigned_to?: string | null;
  completed_at?: string | null;
  closed_at?: string | null;
}): WorkStage {
  if (record.type !== "hazard" || record.status !== "approved") return "none";
  if (record.closed_at) return "closed";
  if (record.completed_at) return "verify";
  if (record.assigned_to) return "assigned";
  return "unassigned";
}

// `due_on` is a calendar date; local noon keeps the same day in every timezone.
function parseDueOn(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatDueDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = parseDueOn(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function daysUntilDue(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const due = parseDueOn(value);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function isOverdue(
  record: { due_on?: string | null; closed_at?: string | null },
  now = Date.now()
): boolean {
  if (!record.due_on || record.closed_at) return false;
  const days = daysUntilDue(record.due_on, now);
  return days !== null && days < 0;
}
