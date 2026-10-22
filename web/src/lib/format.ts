// Shared labels, colours and date helpers for the dashboard.
import type {
  HazardSeverity,
  RecordStatus,
  RecordType,
  UserRole,
} from "./types";

export const TYPE_LABELS: Record<RecordType, string> = {
  flora: "Flora",
  soil_water: "Soil/Water",
  hazard: "Hazard",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  field_worker: "Field worker",
  supervisor: "Supervisor",
  admin: "Administrator",
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

export const TYPE_STYLES: Record<RecordType, string> = {
  flora: "bg-flora-soft text-flora",
  soil_water: "bg-water-soft text-water",
  hazard: "bg-hazard-soft text-hazard",
};

export const TYPE_DOT_CLASSES: Record<RecordType, string> = {
  flora: "bg-flora",
  soil_water: "bg-water",
  hazard: "bg-hazard",
};

export const TYPE_TILE_STYLES: Record<RecordType, string> = {
  flora: "bg-flora-soft text-flora",
  soil_water: "bg-water-soft text-water",
  hazard: "bg-hazard-soft text-hazard",
};

export const STATUS_STYLES: Record<RecordStatus, string> = {
  pending: "bg-warning-soft text-warning-ink",
  approved: "bg-positive-soft text-positive-ink",
  rejected: "bg-negative-soft text-negative-ink",
};

export const SEVERITY_STYLES: Record<HazardSeverity, string> = {
  low: "bg-sev-low/10 text-sev-low",
  medium: "bg-sev-medium/10 text-sev-medium",
  critical: "bg-sev-critical/10 text-sev-critical",
};

export const TYPE_CHART_COLORS: Record<RecordType, string> = {
  flora: "#1F6B4A",
  soil_water: "#2B6CB0",
  hazard: "#C4242A",
};

export const SEVERITY_CHART_COLORS: Record<HazardSeverity, string> = {
  low: "#8A6516",
  medium: "#C2410C",
  critical: "#991B1B",
};

// The single chart hue, and the ramp used where severity has to advance.
export const CHART_HUE = "#1F6B4A";

export const GROWTH_STAGES = ["Not specified", "Seedling", "Sapling", "Mature"];
export const HEALTH_CONDITIONS = ["Healthy", "Stressed", "Diseased", "Dying", "Dead"];
export const HAZARD_TYPES = [
  "Fallen debris",
  "Eroded ground",
  "Blocked drainage",
  "Silt runoff",
  "Rockfall risk",
];
export const READING_TYPES = ["pH", "Moisture", "Water level", "Turbidity", "Temperature", "Soil depth"];

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The subtitle line for a record: species, hazard type or reading.
export function recordSubtitle(record: {
  type: RecordType;
  species_name?: string | null;
  hazard_type?: string | null;
  reading_type?: string | null;
  reading_value?: number | null;
  reading_unit?: string | null;
}): string {
  if (record.type === "flora") return record.species_name || "Flora observation";
  if (record.type === "hazard") return record.hazard_type || "Hazard observation";
  const value = record.reading_value == null ? "" : ` ${record.reading_value}`;
  const unit = record.reading_unit ? ` ${record.reading_unit}` : "";
  return `${record.reading_type || "Soil & water"}${value}${unit}`.trim();
}
