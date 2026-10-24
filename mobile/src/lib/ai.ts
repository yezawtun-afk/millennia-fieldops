// Mobile side of the AI photo assistant. The photo is shrunk, converted to
// base64, and sent to our Supabase Edge Function. The Google API key stays on
// the server; this file never talks to Google directly.
//
// The same function handles hazard and flora records. The record type is sent
// with the request, and every answer is validated against the same option
// lists the form uses before it reaches the review sheet. Soil/water records
// have no AI assist: the worker reads the instrument directly.
import { File } from "expo-file-system";
import { GROWTH_STAGES, HAZARD_TYPES, HEALTH_CONDITIONS } from "./format";
import { preparePhotoForAi } from "./photos";
import { SPECIES_CATALOG } from "./species";
import { supabase } from "./supabase";
import type { HazardSeverity } from "./types";

export type AiRecordType = "hazard" | "flora";

const SEVERITIES: HazardSeverity[] = ["low", "medium", "critical"];
const MAX_BASE64_CHARS = 2_000_000;

export interface HazardAiSuggestion {
  recordType: "hazard";
  title: string;
  hazard_type: string | null;
  severity: HazardSeverity | null;
  notes: string;
  confidence: number;
}

export interface FloraAiSuggestion {
  recordType: "flora";
  title: string;
  species_name: string | null;
  growth_stage: string | null;
  health_condition: string | null;
  estimated_count: number | null;
  notes: string;
  confidence: number;
}

export type AiSuggestion = HazardAiSuggestion | FloraAiSuggestion;

export type AiFailureCode =
  | "not_signed_in"
  | "too_large"
  | "rate_limited"
  | "quota_exhausted"
  | "busy"
  | "unclear_photo"
  | "not_configured"
  | "timeout"
  | "failed";

export type AnalyzePhotoResult =
  | { ok: true; suggestion: AiSuggestion }
  | { ok: false; code: AiFailureCode; message: string };

interface AnalyzePhotoResponse {
  suggestion?: unknown;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanConfidence(value: unknown): number {
  const confidence = Number(value);
  return Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
}

function normaliseSpeciesName(value: string): string | null {
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!cleaned) return null;

  // Use the catalog's scientific name when the model returns a local alias
  // (for example "Paku resam"), but keep any other plant name as free text.
  // The catalog is a shortcut, not a restriction.
  const entry = SPECIES_CATALOG.find((item) =>
    [item.scientific, item.common, item.malay, item.chinese]
      .filter((name): name is string => Boolean(name))
      .some((name) => name.toLowerCase() === cleaned.toLowerCase())
  );
  return entry?.scientific ?? cleaned;
}

function normaliseSuggestion(raw: unknown, recordType: AiRecordType): AiSuggestion | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const confidence = cleanConfidence(record.confidence);

  if (recordType === "hazard") {
    const hazardType = cleanText(record.hazard_type, 80);
    const severity = cleanText(record.severity, 20);

    return {
      recordType,
      title: cleanText(record.title, 70),
      hazard_type: (HAZARD_TYPES as readonly string[]).includes(hazardType) ? hazardType : null,
      severity: (SEVERITIES as readonly string[]).includes(severity)
        ? (severity as HazardSeverity)
        : null,
      notes: cleanText(record.notes, 500),
      confidence,
    };
  }

  const growthStage = cleanText(record.growth_stage, 20);
  const healthCondition = cleanText(record.health_condition, 30);
  const count = Number(record.estimated_count);

  return {
    recordType,
    title: cleanText(record.title, 70),
    species_name: normaliseSpeciesName(cleanText(record.species_name, 80)),
    growth_stage: GROWTH_STAGES.includes(growthStage) ? growthStage : null,
    health_condition: HEALTH_CONDITIONS.includes(healthCondition) ? healthCondition : null,
    estimated_count:
      Number.isFinite(count) && count >= 1 ? Math.min(10_000, Math.round(count)) : null,
    notes: cleanText(record.notes, 500),
    confidence,
  };
}

export function hasAnyAiSuggestion(suggestion: AiSuggestion): boolean {
  if (suggestion.recordType === "hazard") {
    return Boolean(
      suggestion.title || suggestion.hazard_type || suggestion.severity || suggestion.notes
    );
  }
  return Boolean(
    suggestion.title ||
      suggestion.species_name ||
      suggestion.growth_stage ||
      suggestion.health_condition ||
      suggestion.estimated_count
  );
}

export function unclearPhotoMessage(recordType: AiRecordType): string {
  if (recordType === "flora") {
    return "AI could not identify the plant. Try a clearer photo.";
  }
  return "AI could not identify the hazard. Try a clearer photo.";
}

async function readErrorPayload(
  error: unknown
): Promise<{ code?: string; error?: string } | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof context !== "object" || !("json" in context)) return null;

  try {
    const payload = await (context as { json: () => Promise<unknown> }).json();
    if (!payload || typeof payload !== "object") return null;
    const record = payload as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      error: typeof record.error === "string" ? record.error : undefined,
    };
  } catch {
    return null;
  }
}

function failureFromPayload(
  payload: { code?: string } | null,
  recordType: AiRecordType
): AnalyzePhotoResult | null {
  if (!payload?.code) return null;

  switch (payload.code) {
    case "rate_limited":
      return {
        ok: false,
        code: "rate_limited",
        message: "Too many AI requests. Wait a minute and try again.",
      };
    case "quota_exhausted":
      // The daily quota is gone until Google resets it, so retrying soon is
      // pointless. Point the worker at the manual form instead.
      return {
        ok: false,
        code: "quota_exhausted",
        message: "AI has reached today's limit. Enter the record manually, or try again later.",
      };
    case "busy":
      return {
        ok: false,
        code: "busy",
        message: "AI is busy right now. Wait a minute and try again.",
      };
    case "unclear_photo":
      return {
        ok: false,
        code: "unclear_photo",
        message: unclearPhotoMessage(recordType),
      };
    case "image_too_large":
      return {
        ok: false,
        code: "too_large",
        message: "Photo is too large for AI analysis. Try another photo.",
      };
    case "not_configured":
      return {
        ok: false,
        code: "not_configured",
        message: "AI is not set up yet. Ask an administrator.",
      };
    default:
      return null;
  }
}

export async function analyzePhoto(
  uri: string,
  recordType: AiRecordType
): Promise<AnalyzePhotoResult> {
  let preparedUri: string | null = null;

  try {
    preparedUri = await preparePhotoForAi(uri);
    const file = new File(preparedUri);

    if ((file.size ?? 0) > 1_500_000) {
      return {
        ok: false,
        code: "too_large",
        message: "Photo is too large for AI analysis. Try another photo.",
      };
    }

    const imageBase64 = await file.base64();
    if (imageBase64.length > MAX_BASE64_CHARS) {
      return {
        ok: false,
        code: "too_large",
        message: "Photo is too large for AI analysis. Try another photo.",
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return {
        ok: false,
        code: "not_signed_in",
        message: "Please sign in again to use AI.",
      };
    }

    const { data, error } = await supabase.functions.invoke<AnalyzePhotoResponse>(
      "analyze-record",
      {
        body: { recordType, imageBase64, mimeType: "image/jpeg" },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60_000,
      }
    );

    if (error) {
      const payload = await readErrorPayload(error);
      const mapped = failureFromPayload(payload, recordType);
      if (mapped) return mapped;

      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("abort") || message.includes("timeout")) {
        return {
          ok: false,
          code: "timeout",
          message: "AI took too long. Try again or fill the form manually.",
        };
      }

      return {
        ok: false,
        code: "failed",
        message: "AI could not analyze this photo. You can still save the record manually.",
      };
    }

    const suggestion = normaliseSuggestion(data?.suggestion, recordType);
    if (!suggestion) {
      return {
        ok: false,
        code: "failed",
        message: "The AI result could not be read. Try again.",
      };
    }

    return { ok: true, suggestion };
  } catch {
    return {
      ok: false,
      code: "failed",
      message: "AI could not analyze this photo. You can still save the record manually.",
    };
  } finally {
    if (preparedUri && preparedUri !== uri) {
      try {
        const temporary = new File(preparedUri);
        if (temporary.exists) temporary.delete();
      } catch {
        // A leftover cache file is harmless.
      }
    }
  }
}
