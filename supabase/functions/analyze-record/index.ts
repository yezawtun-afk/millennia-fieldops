// Supabase Edge Function: analyze a record photo with Google Gemini.
//
// The mobile app never talks to Google directly. This function holds the API
// key, checks that the caller is a signed-in, active user, and returns only a
// small validated suggestion for the record type that was asked for. The
// worker still reviews and edits every field before saving.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type RecordType = "hazard" | "flora";

const HAZARD_TYPES = [
  "Fallen debris",
  "Eroded ground",
  "Blocked drainage",
  "Silt runoff",
  "Rockfall risk",
] as const;

const SEVERITIES = ["low", "medium", "critical"] as const;

const GROWTH_STAGES = ["Seedling", "Sapling", "Mature"] as const;
const HEALTH_CONDITIONS = ["Healthy", "Stressed", "Diseased", "Dying", "Dead"] as const;

const MAX_BASE64_CHARS = 2_000_000; // about 1.5 MB of JPEG data
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASE_PROMPT = `You are a careful photo-triage assistant for a field worker at a conservation site in Malaysia.

Analyse the single attached photo and return a JSON object matching the schema.

Global rules:
- Only describe what is clearly visible in the photo.
- Do not guess the location, the identity of people, the weather, or the cause.
- Do not provide safety instructions, treatment, or recommended actions.
- If the photo is unclear or does not show the expected subject, return empty strings and 0 where the schema uses a number, with a low confidence.
- The notes must be 1-2 short factual sentences (maximum 60 words).
- Confidence must be a number from 0 to 1.`;

const HAZARD_PROMPT = `${BASE_PROMPT}

Hazard rules:
- The title must be short and factual (maximum 70 characters).
- Choose the hazard category and severity from the lists below.

Hazard categories:
- "Fallen debris": fallen branches, logs, rocks, garbage, or other loose material and obstacles.
- "Eroded ground": exposed soil, gullies, landslides, slope failure, or washed-out ground.
- "Blocked drainage": a drain, culvert, or channel blocked by leaves, silt, or debris, often with standing water.
- "Silt runoff": muddy water or sediment flowing onto roads, paths, or nearby ground.
- "Rockfall risk": loose rocks, boulders, or a slope that appears likely to fall.

Severity:
- "low": minor issue with no obvious immediate risk.
- "medium": needs attention and could become worse.
- "critical": obvious immediate risk to people, roads, water, or property.

Return an empty string for a field when the photo does not support a confident answer.`;

const FLORA_PROMPT = `${BASE_PROMPT}

You are an expert tropical botanist specializing in Southeast Asian flora, especially Peninsular Malaysia.

Plant rules:
- Identify the plant as precisely as the photo allows.
- species_name must be the scientific name (Genus species). If you are not certain of the exact species, use the genus followed by "sp." (for example "Ficus sp.") or the plant family (for example "Fern family"). Do not leave species_name empty when a plant is clearly visible.
- title must be a short common name (for example "Bird's Nest Fern", "Oil Palm", "Mile-a-minute"). If the common name is unknown, use the genus or family name.
- Do not invent a species. Only use a name you believe exists.
- growth_stage must be one of "Seedling", "Sapling", "Mature", or an empty string.
- health_condition must be one of "Healthy", "Stressed", "Diseased", "Dying", "Dead", or an empty string.
- estimated_count is the number of individual plants of the identified species visible in the photo. Use 0 if you cannot estimate it.
- notes: 1-2 short factual sentences (maximum 60 words) about visible features, native or invasive status if known, or habitat.
- If the photo is too blurry or does not clearly show a plant, return empty strings, 0 count, and 0 confidence.

Growth stages:
- "Seedling": small, young, recently established.
- "Sapling": young woody plant, not yet mature.
- "Mature": fully grown plant.

Health conditions:
- "Healthy": normal colour and structure, no visible damage.
- "Stressed": wilting, yellowing, or poor vigour.
- "Diseased": spots, rot, or other signs of disease.
- "Dying": mostly dead or collapsing.
- "Dead": no living tissue visible.`;

const CONFIDENCE_PROPERTY = {
  type: "number",
  description: "Confidence from 0 to 1.",
} as const;

const NOTES_PROPERTY = {
  type: "string",
  description: "1-2 short factual sentences, maximum 60 words.",
} as const;

const HAZARD_SCHEMA = {
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
      description: 'One of "low", "medium", "critical", or an empty string if unclear.',
    },
    notes: NOTES_PROPERTY,
    confidence: CONFIDENCE_PROPERTY,
  },
  required: ["title", "hazard_type", "severity", "notes", "confidence"],
};

const FLORA_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "Short common name, maximum 70 characters. Use the genus or family name if the common name is unknown.",
    },
    species_name: {
      type: "string",
      description:
        'Scientific name (Genus species). Use "Genus sp." or the plant family when the exact species is uncertain. Empty only when no plant is visible.',
    },
    growth_stage: {
      type: "string",
      description: 'One of "Seedling", "Sapling", "Mature", or an empty string if unclear.',
    },
    health_condition: {
      type: "string",
      description:
        'One of "Healthy", "Stressed", "Diseased", "Dying", "Dead", or an empty string if unclear.',
    },
    estimated_count: {
      type: "number",
      description:
        "Estimated number of individual plants of this species visible in the photo, or 0 if it cannot be estimated.",
    },
    notes: NOTES_PROPERTY,
    confidence: CONFIDENCE_PROPERTY,
  },
  required: [
    "title",
    "species_name",
    "growth_stage",
    "health_condition",
    "estimated_count",
    "notes",
    "confidence",
  ],
};

interface HazardSuggestion {
  title: string;
  hazard_type: string;
  severity: string;
  notes: string;
  confidence: number;
}

interface FloraSuggestion {
  title: string;
  species_name: string;
  growth_stage: string;
  health_condition: string;
  estimated_count: number;
  notes: string;
  confidence: number;
}

type Suggestion = HazardSuggestion | FloraSuggestion;

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

function cleanConfidence(value: unknown): number {
  const confidence = Number(value);
  return Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
}

function cleanSpecies(value: unknown): string {
  // Accept genus/family fallbacks and free-text names. The catalog is only a
  // shortcut in the app, not a restriction on what the model may identify.
  return cleanText(value, 80).replace(/\s+/g, " ");
}

function normaliseHazard(record: Record<string, unknown>): HazardSuggestion {
  const hazardType = cleanText(record.hazard_type, 80);
  const severity = cleanText(record.severity, 20);

  return {
    title: cleanText(record.title, 70),
    hazard_type: (HAZARD_TYPES as readonly string[]).includes(hazardType) ? hazardType : "",
    severity: (SEVERITIES as readonly string[]).includes(severity) ? severity : "",
    notes: cleanText(record.notes, 500),
    confidence: cleanConfidence(record.confidence),
  };
}

function normaliseFlora(record: Record<string, unknown>): FloraSuggestion {
  const growthStage = cleanText(record.growth_stage, 20);
  const healthCondition = cleanText(record.health_condition, 30);
  const count = Number(record.estimated_count);

  return {
    title: cleanText(record.title, 70),
    species_name: cleanSpecies(record.species_name),
    growth_stage: (GROWTH_STAGES as readonly string[]).includes(growthStage) ? growthStage : "",
    health_condition: (HEALTH_CONDITIONS as readonly string[]).includes(healthCondition)
      ? healthCondition
      : "",
    estimated_count:
      Number.isFinite(count) && count >= 1 ? Math.min(10_000, Math.round(count)) : 0,
    notes: cleanText(record.notes, 500),
    confidence: cleanConfidence(record.confidence),
  };
}

function hasContent(recordType: RecordType, suggestion: Suggestion): boolean {
  if (recordType === "hazard") {
    const hazard = suggestion as HazardSuggestion;
    return Boolean(hazard.title || hazard.hazard_type || hazard.severity || hazard.notes);
  }
  const flora = suggestion as FloraSuggestion;
  return Boolean(
    flora.title ||
      flora.species_name ||
      flora.growth_stage ||
      flora.health_condition ||
      flora.estimated_count
  );
}

function promptFor(recordType: RecordType): string {
  return recordType === "flora" ? FLORA_PROMPT : HAZARD_PROMPT;
}

function schemaFor(recordType: RecordType): unknown {
  return recordType === "flora" ? FLORA_SCHEMA : HAZARD_SCHEMA;
}

function parseModelJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

// Google names the exhausted quota in the 429 body, for example
// "GenerateRequestsPerDayPerProjectPerModel-FreeTier". Anything with "per day"
// in it only resets at midnight Pacific time, so retrying soon cannot work.
// Per-minute limits and spend caps look different and do clear on their own.
function isDailyQuotaExhausted(body: string): boolean {
  return /per[\s_-]?day/i.test(body);
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

  let body: { recordType?: unknown; imageBase64?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "The request body must be JSON." }, 400);
  }

  const recordType = body.recordType;
  if (recordType !== "hazard" && recordType !== "flora") {
    return json({ error: "Unknown record type." }, 400);
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
          { type: "text", text: promptFor(recordType) },
          { type: "image", data: imageBase64, mime_type: mimeType },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: schemaFor(recordType),
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
      // A per-day quota does not clear in a minute: tell the worker to enter the
      // record by hand instead of retrying. A per-minute or spend limit resets
      // on its own, so a short wait is enough there.
      if (isDailyQuotaExhausted(googleError)) {
        return json(
          {
            code: "quota_exhausted",
            error: "AI has reached today's limit. Enter the record manually, or try again later.",
          },
          429
        );
      }
      return json(
        { code: "rate_limited", error: "Too many AI requests. Wait a minute and try again." },
        429
      );
    }

    if (googleResponse.status === 503) {
      return json(
        { code: "busy", error: "AI is busy right now. Wait a minute and try again." },
        503
      );
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
    const raw = parseModelJson(text);
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    suggestion = recordType === "flora" ? normaliseFlora(record) : normaliseHazard(record);
  } catch {
    return json({ code: "analysis_failed", error: "The AI response could not be read." }, 502);
  }

  if (!hasContent(recordType, suggestion)) {
    return json(
      { code: "unclear_photo", error: "The photo was not clear enough for this record type." },
      422
    );
  }

  return json({ recordType, suggestion });
});
