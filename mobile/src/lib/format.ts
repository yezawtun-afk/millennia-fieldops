import { colors } from "../theme";
import { READING_DEFINITIONS } from "./measurements";
import type { HazardSeverity, RecordStatus, RecordType, UserRole } from "./types";

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

export const TYPE_COLORS: Record<RecordType, { fg: string; bg: string }> = {
  flora: { fg: colors.flora, bg: colors.floraSoft },
  soil_water: { fg: colors.water, bg: colors.waterSoft },
  hazard: { fg: colors.hazard, bg: colors.hazardSoft },
};

export const STATUS_COLORS: Record<RecordStatus, { fg: string; bg: string }> = {
  pending: { fg: colors.pendingInk, bg: colors.pendingSoft },
  approved: { fg: colors.approvedInk, bg: colors.approvedSoft },
  rejected: { fg: colors.rejectedInk, bg: colors.rejectedSoft },
};

export const SEVERITY_COLORS: Record<HazardSeverity, { fg: string; bg: string }> = {
  low: { fg: colors.sevLow, bg: colors.sevLowSoft },
  medium: { fg: colors.sevMedium, bg: colors.sevMediumSoft },
  critical: { fg: colors.sevCritical, bg: colors.sevCriticalSoft },
};

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
