// Supabase Edge Function: analyze a hazard photo with Google Gemini.
//
// The mobile app never talks to Google directly. This function holds the API
// key, checks that the caller is a signed-in, active user, and returns only a
// small validated suggestion. The worker still reviews and edits every field.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const HAZARD_TYPES = [
  "Fallen debris",
  "Eroded ground",
  "Blocked drainage",
  "Silt runoff",
  "Rockfall risk",
] as const;

const SEVERITIES = ["low", "medium", "critical"] as const;

const MAX_BASE64_CHARS = 2_000_000; // about 1.5 MB of JPEG data
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `You are a careful photo-triage assistant for a field worker at a conservation site in Malaysia.

Analyse the single attached photo and return a JSON object matching the schema.

Rules:
- Only describe what is clearly visible in the photo.
- Do not guess the location, the identity of people, the weather, or the cause.
- Do not provide safety instructions or recommended actions.
- If the photo is unclear or does not show a hazard, return empty strings and a low confidence.
- The title must be short and factual (maximum 70 characters).
- The notes must be 1-2 short factual sentences (maximum 60 words).

Hazard categories:
- "Fallen debris": fallen branches, logs, rocks, or other loose material.
- "Eroded ground": exposed soil, gullies, or ground loss.
- "Blocked drainage": a drain, culvert, or channel blocked by material.
- "Silt runoff": muddy water or sediment flowing away from a site.
- "Rockfall risk": loose rocks or a slope that appears likely to fall.

Severity:
- "low": minor issue with no obvious immediate risk.
- "medium": needs attention and could become worse.
- "critical": obvious immediate risk to people, roads, water, or property.

Return an empty string for a field when the photo does not support a confident answer.
Confidence must be a number from 0 to 1.`;

interface Suggestion {
  title: string;
  hazard_type: string;
  severity: string;
  notes: string;
  confidence: number;
}

interface InteractionContent {
  type?: string;
  text?: string;
}

interface InteractionStep {
  type?: string;
  content?: InteractionContent[];
}

interface InteractionResponse {
  status?: string;
  output_text?: string;
  steps?: InteractionStep[];
  error?: { code?: number; message?: string; status?: string };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normaliseSuggestion(raw: unknown): Suggestion {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hazardType = cleanText(record.hazard_type, 80);
  const severity = cleanText(record.severity, 20);
  const confidence = Number(record.confidence);

  return {
    title: cleanText(record.title, 70),
    hazard_type: (HAZARD_TYPES as readonly string[]).includes(hazardType) ? hazardType : "",
    severity: (SEVERITIES as readonly string[]).includes(severity) ? severity : "",
    notes: cleanText(record.notes, 500),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
}

function parseModelJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const googleKey = Deno.env.get("GOOGLE_AI_STUDIO_KEY");

  if (!supabaseUrl || !anonKey) {
    return json({ error: "Supabase is not configured on this function." }, 503);
  }
  if (!googleKey) {
    return json(
      { code: "not_configured", error: "AI is not configured. Add GOOGLE_AI_STUDIO_KEY." },
      503
    );
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "Please sign in again." }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return json({ error: "Please sign in again." }, 401);
  }

  // Optional account check. If the service key is unavailable, authentication
  // alone is still enough for the function to run.
  if (serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("is_active, status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && profile) {
      if (profile.is_active === false || (profile.status && profile.status !== "approved")) {
        return json({ error: "This account is not active." }, 403);
      }
    }
  }

  let body: { imageBase64?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "The request body must be JSON." }, 400);
  }

  const imageBase64 =
    typeof body.imageBase64 === "string"
      ? body.imageBase64.replace(/^data:[^;]+;base64,/, "")
      : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";

  if (!imageBase64) {
    return json({ error: "A photo is required." }, 400);
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return json({ code: "image_too_large", error: "The photo is too large for analysis." }, 413);
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return json({ error: "Only JPEG, PNG, or WebP photos are supported." }, 415);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let googleResponse: Response;

  try {
    googleResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": googleKey,
        "Api-Revision": "2026-05-20",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        store: false,
        input: [
          { type: "text", text: PROMPT },
          { type: "image", data: imageBase64, mime_type: mimeType },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Short factual title, maximum 70 characters.",
              },
              hazard_type: {
                type: "string",
                description:
                  'One of "Fallen debris", "Eroded ground", "Blocked drainage", "Silt runoff", "Rockfall risk", or an empty string if unclear.',
              },
              severity: {
                type: "string",
                description:
                  'One of "low", "medium", "critical", or an empty string if unclear.',
              },
              notes: {
                type: "string",
                description: "1-2 short factual sentences, maximum 60 words.",
              },
              confidence: {
                type: "number",
                description: "Confidence from 0 to 1.",
              },
            },
            required: ["title", "hazard_type", "severity", "notes", "confidence"],
          },
        },
      }),
    });
  } catch (error) {
    const debug = request.headers.get("x-debug-ai") === "true";
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Gemini request failed", detail);
    return json(
      {
        code: "analysis_failed",
        error: "AI could not analyze the photo.",
        ...(debug ? { googleError: detail } : {}),
      },
      502
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!googleResponse.ok) {
    const googleError = (await googleResponse.text().catch(() => "")).slice(0, 800);
    console.error("Gemini returned", googleResponse.status, googleError);
    if (googleResponse.status === 429) {
      return json({ code: "rate_limited", error: "AI is busy. Try again later." }, 429);
    }
    if (googleResponse.status === 503) {
      return json({ code: "busy", error: "AI is busy. Try again later." }, 503);
    }
    const debug = request.headers.get("x-debug-ai") === "true";
    return json(
      {
        code: "analysis_failed",
        error: "AI could not analyze the photo.",
        ...(debug ? { googleStatus: googleResponse.status, googleError } : {}),
      },
      502
    );
  }

  let payload: InteractionResponse;
  try {
    payload = (await googleResponse.json()) as InteractionResponse;
  } catch {
    return json({ code: "analysis_failed", error: "The AI response could not be read." }, 502);
  }

  if (payload.error || payload.status === "failed") {
    const debug = request.headers.get("x-debug-ai") === "true";
    console.error("Gemini interaction failed", payload.error ?? payload.status);
    return json(
      {
        code: "analysis_failed",
        error: "AI could not analyze the photo.",
        ...(debug
          ? {
              googleStatus: googleResponse.status,
              googleError: JSON.stringify(payload.error ?? { status: payload.status }).slice(0, 800),
            }
          : {}),
      },
      502
    );
  }

  const text =
    typeof payload.output_text === "string" && payload.output_text.trim()
      ? payload.output_text.trim()
      : (payload.steps ?? [])
          .filter((step) => step.type === "model_output")
          .flatMap((step) => step.content ?? [])
          .filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join("")
          .trim();

  if (!text) {
    return json({ code: "unclear_photo", error: "The photo was not clear enough." }, 422);
  }

  let suggestion: Suggestion;
  try {
    suggestion = normaliseSuggestion(parseModelJson(text));
  } catch {
    return json({ code: "analysis_failed", error: "The AI response could not be read." }, 502);
  }

  if (
    !suggestion.title &&
    !suggestion.hazard_type &&
    !suggestion.severity &&
    !suggestion.notes
  ) {
    return json(
      { code: "unclear_photo", error: "AI could not identify the hazard. Try a clearer photo." },
      422
    );
  }

  return json({ suggestion });
});
