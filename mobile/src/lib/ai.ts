// Mobile side of the hazard-photo assistant. The photo is shrunk, converted to
// base64, and sent to our Supabase Edge Function. The Google API key stays on
// the server; this file never talks to Google directly.
import { File } from "expo-file-system";
import { HAZARD_TYPES } from "./format";
import { preparePhotoForAi } from "./photos";
import { supabase } from "./supabase";
import type { HazardSeverity } from "./types";

const SEVERITIES: HazardSeverity[] = ["low", "medium", "critical"];
const MAX_BASE64_CHARS = 2_000_000;

export interface HazardAiSuggestion {
  title: string;
  hazard_type: string | null;
  severity: HazardSeverity | null;
  notes: string;
  confidence: number;
}

export type AiFailureCode =
  | "not_signed_in"
  | "too_large"
  | "rate_limited"
  | "busy"
  | "unclear_photo"
  | "not_configured"
  | "timeout"
  | "failed";

export type AnalyzeHazardResult =
  | { ok: true; suggestion: HazardAiSuggestion }
  | { ok: false; code: AiFailureCode; message: string };

interface AnalyzeHazardResponse {
  suggestion?: unknown;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normaliseSuggestion(raw: unknown): HazardAiSuggestion | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const hazardType = cleanText(record.hazard_type, 80);
  const severity = cleanText(record.severity, 20);
  const confidence = Number(record.confidence);

  return {
    title: cleanText(record.title, 70),
    hazard_type: (HAZARD_TYPES as readonly string[]).includes(hazardType) ? hazardType : null,
    severity: (SEVERITIES as readonly string[]).includes(severity)
      ? (severity as HazardSeverity)
      : null,
    notes: cleanText(record.notes, 500),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
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

function failureFromPayload(payload: { code?: string } | null): AnalyzeHazardResult | null {
  if (!payload?.code) return null;

  switch (payload.code) {
    case "rate_limited":
      return {
        ok: false,
        code: "rate_limited",
        message: "Too many AI requests. Try again later.",
      };
    case "busy":
      return {
        ok: false,
        code: "busy",
        message: "AI is busy. Try again later.",
      };
    case "unclear_photo":
      return {
        ok: false,
        code: "unclear_photo",
        message: "AI could not identify the hazard. Try a clearer photo.",
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

export async function analyzeHazardPhoto(uri: string): Promise<AnalyzeHazardResult> {
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

    const { data, error } = await supabase.functions.invoke<AnalyzeHazardResponse>(
      "analyze-hazard",
      {
        body: { imageBase64, mimeType: "image/jpeg" },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60_000,
      }
    );

    if (error) {
      const payload = await readErrorPayload(error);
      const mapped = failureFromPayload(payload);
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

    const suggestion = normaliseSuggestion(data?.suggestion);
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
