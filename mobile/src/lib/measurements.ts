// Standard soil / water readings. The form uses these definitions to offer the
// right unit and reject impossible values before a record is uploaded.
export interface MeasurementRange {
  min: number;
  max: number;
}

export interface ReadingDefinition {
  /** Allowed units, best first. The first one is selected automatically. */
  units: string[];
  /** Plausible range for each unit. */
  ranges: Record<string, MeasurementRange>;
  /** Placeholder example for the value field. */
  example: string;
  /** English key passed through t() in the form. */
  hint: string;
}

export const READING_DEFINITIONS: Record<string, ReadingDefinition> = {
  pH: {
    units: ["pH"],
    ranges: { pH: { min: 0, max: 14 } },
    example: "6.8",
    hint: "0–14 pH. 7 is neutral.",
  },
  Moisture: {
    units: ["%"],
    ranges: { "%": { min: 0, max: 100 } },
    example: "42",
    hint: "Soil moisture as a percentage of a saturated sample.",
  },
  "Water level": {
    units: ["m", "cm"],
    ranges: { m: { min: 0, max: 20 }, cm: { min: 0, max: 2000 } },
    example: "1.25",
    hint: "Depth from a fixed gauge mark or the water surface.",
  },
  Turbidity: {
    units: ["NTU"],
    ranges: { NTU: { min: 0, max: 1000 } },
    example: "18",
    hint: "Lower NTU means clearer water.",
  },
  Temperature: {
    units: ["°C"],
    ranges: { "°C": { min: -10, max: 60 } },
    example: "27.5",
    hint: "Water or soil temperature at the sample point.",
  },
  "Soil depth": {
    units: ["cm"],
    ranges: { cm: { min: 0, max: 300 } },
    example: "45",
    hint: "Depth of the soil profile at the sample point.",
  },
};

export function getReadingDefinition(type: string | null): ReadingDefinition | null {
  return type ? READING_DEFINITIONS[type] ?? null : null;
}

export function defaultUnitFor(type: string | null): string {
  const definition = getReadingDefinition(type);
  return definition?.units[0] ?? "";
}

export function rangeFor(type: string | null, unit: string | null): MeasurementRange | null {
  const definition = getReadingDefinition(type);
  if (!definition || !unit) return null;
  return definition.ranges[unit] ?? null;
}

export interface ReadingError {
  key: string;
  params: Record<string, string | number>;
}

export function validateReading(
  type: string | null,
  value: string,
  unit: string | null
): ReadingError | null {
  const definition = getReadingDefinition(type);
  if (!definition) {
    return { key: "Choose a reading type - or save it as a draft.", params: {} };
  }

  const typeName = type ?? "";
  if (!unit || !definition.ranges[unit]) {
    return { key: "Choose a unit for {type}.", params: { type: typeName } };
  }

  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number)) {
    return { key: "Enter a valid number for {type}.", params: { type: typeName } };
  }

  const range = definition.ranges[unit];
  if (number < range.min || number > range.max) {
    return {
      key: "Reading is outside the expected range ({min}–{max} {unit}).",
      params: { min: range.min, max: range.max, unit },
    };
  }

  return null;
}
