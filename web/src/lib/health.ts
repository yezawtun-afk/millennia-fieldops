// The Village Ecological Health Index.
//
// One number between 0 and 100 that says whether the site is getting better or
// worse. It is deliberately built from RATES, not raw counts: a fixed penalty per
// hazard would sink a site to zero simply because it has more records, so a big
// clean village would score worse than a small dirty one. Everything here is
// pure and testable — no React, no database.
import type { FieldRecord } from "./types";

// How much of the score each signal can take away. They add up to 100, so a site
// that is worst in every way scores 0 and a spotless one scores 100.
export const HEALTH_WEIGHTS = {
  critical: 45,
  medium: 20,
  water: 20,
  backlog: 15,
} as const;

// A pending record older than this counts against the backlog term.
export const BACKLOG_DAYS = 7;

// The only readings that can be called abnormal without a local baseline. Soil
// moisture, water level, soil depth and temperature have no absolute norm in
// this project, so they are never judged.
export const WATER_THRESHOLDS = {
  phMin: 6.5,
  phMax: 8.5,
  turbidityMaxNtu: 50,
} as const;

export type HealthBand = "good" | "warning" | "critical" | "unknown";

/** English keys for t(); the dashboard and the gauge both use these. */
export const HEALTH_BAND_LABELS: Record<HealthBand, string> = {
  good: "Good",
  warning: "Warning",
  critical: "Critical",
  unknown: "Not enough data",
};

export interface HealthInputs {
  /** Hazards that still exist (rejected ones are not hazards). */
  hazards: number;
  /** Of those, hazards rated critical that have not been completed. */
  openCritical: number;
  openMedium: number;
  /** Measured pH or turbidity readings. */
  waterTests: number;
  /** Of those, readings outside the thresholds above. */
  abnormalWater: number;
  pending: number;
  /** Pending for longer than BACKLOG_DAYS. */
  backlog: number;
}

export interface HealthScore {
  /** null when there is nothing to judge yet. */
  score: number | null;
  band: HealthBand;
  inputs: HealthInputs;
  /** Points removed by each term; they sum to 100 - score. */
  penalties: { critical: number; medium: number; water: number; backlog: number };
  /** Fractions in 0..1, for display. */
  rates: { critical: number; medium: number; water: number; backlog: number };
}

export function isAbnormalReading(reading: {
  reading_type?: string | null;
  reading_value?: number | string | null;
  reading_unit?: string | null;
}): boolean {
  const value = Number(reading.reading_value);
  if (!Number.isFinite(value)) return false;

  const type = (reading.reading_type ?? "").trim().toLowerCase();
  const unit = (reading.reading_unit ?? "").trim().toLowerCase();

  if (type === "ph" || unit === "ph") {
    return value < WATER_THRESHOLDS.phMin || value > WATER_THRESHOLDS.phMax;
  }
  if (type === "turbidity" || unit === "ntu") {
    // A different unit would need converting before comparing.
    if (unit && unit !== "ntu") return false;
    return value > WATER_THRESHOLDS.turbidityMaxNtu;
  }
  return false;
}

export function scoreBand(score: number | null): HealthBand {
  if (score === null) return "unknown";
  if (score >= 80) return "good";
  if (score >= 50) return "warning";
  return "critical";
}

function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

export function scoreVillage(records: FieldRecord[], now = Date.now()): HealthScore {
  const live = records.filter((record) => record.status !== "rejected");

  const hazards = live.filter((record) => record.type === "hazard");
  // Unrated hazards still count as hazards, but they cannot be "critical", so
  // they would water down the critical share. Rate the term only over hazards
  // that carry a severity.
  const rated = hazards.filter((record) => record.severity != null);
  const openCritical = rated.filter(
    (record) => record.severity === "critical" && !record.completed_at
  ).length;
  const openMedium = rated.filter(
    (record) => record.severity === "medium" && !record.completed_at
  ).length;

  const waterTests = live.filter(
    (record) =>
      record.type === "soil_water" &&
      (record.reading_type === "pH" ||
        record.reading_type === "Turbidity" ||
        (record.reading_unit ?? "").toUpperCase() === "NTU")
  );
  const abnormalWater = waterTests.filter((record) => isAbnormalReading(record)).length;

  const pendingRecords = records.filter((record) => record.status === "pending");
  const cutoff = now - BACKLOG_DAYS * 86_400_000;
  const backlog = pendingRecords.filter(
    (record) => new Date(record.created_at).getTime() < cutoff
  ).length;

  const inputs: HealthInputs = {
    hazards: rated.length,
    openCritical,
    openMedium,
    waterTests: waterTests.length,
    abnormalWater,
    pending: pendingRecords.length,
    backlog,
  };

  const rates = {
    critical: ratio(openCritical, rated.length),
    medium: ratio(openMedium, rated.length),
    water: ratio(abnormalWater, waterTests.length),
    backlog: ratio(backlog, pendingRecords.length),
  };

  const penalties = {
    critical: rates.critical * HEALTH_WEIGHTS.critical,
    medium: rates.medium * HEALTH_WEIGHTS.medium,
    water: rates.water * HEALTH_WEIGHTS.water,
    backlog: rates.backlog * HEALTH_WEIGHTS.backlog,
  };

  // Nothing measured yet: say so instead of pretending the village is perfect.
  if (rated.length === 0 && waterTests.length === 0) {
    return { score: null, band: "unknown", inputs, penalties, rates };
  }

  const raw =
    100 -
    penalties.critical -
    penalties.medium -
    penalties.water -
    penalties.backlog;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return { score, band: scoreBand(score), inputs, penalties, rates };
}
