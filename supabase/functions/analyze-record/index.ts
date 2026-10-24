// Supabase Edge Function: analyze a record photo with Google Gemini.
//
// The mobile app never talks to Google directly. This function holds the API
// key, checks that the caller is a signed-in, active user, and returns only a
// small validated suggestion for the record type that was asked for. The
// worker still reviews and edits every field before saving.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type RecordType = "hazard" | "flora" | "soil_water";

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

// Keep this list in sync with mobile/src/lib/species.ts. The mobile app validates
// the answer against its own copy, so a drift can only remove a suggestion - it
// can never put an unknown species into a record.
// [scientific, common, Malay]
const SPECIES_CATALOG = [
  ["Dicranopteris linearis", "False staghorn fern", "Paku resam"],
  ["Imperata cylindrica", "Cogon grass", "Lalang"],
  ["Macaranga tanarius", "Macaranga", "Mahang"],
  ["Ficus fistulosa", "Common red stem fig", "Ara"],
  ["Melastoma malabathricum", "Singapore rhododendron", "Senduduk"],
  ["Nephrolepis biserrata", "Giant sword fern", "Paku pedang"],
  ["Lygodium microphyllum", "Climbing fern", "Paku kawat"],
  ["Mikania micrantha", "Mile-a-minute", "Selaput tunggul"],
  ["Chromolaena odorata", "Siam weed", "Pokok kapal terbang"],
  ["Acacia mangium", "Mangium", "Mangium"],
  ["Hevea brasiliensis", "Rubber tree", "Pokok getah"],
  ["Elaeis guineensis", "Oil palm", "Kelapa sawit"],
  ["Musa spp.", "Banana", "Pisang"],
  ["Bambusa vulgaris", "Common bamboo", "Buluh"],
  ["Scirpus grossus", "Greater club-rush", "Rumput menderong"],
  ["Lepironia articulata", "Grey sedge", "Rumput purun"],
  ["Pandanus amaryllifolius", "Pandan", "Pandan"],
  ["Alpinia galanga", "Greater galangal", "Lengkuas"],
  ["Cynodon dactylon", "Bermuda grass", "Rumput Bermuda"],
  ["Paspalum conjugatum", "Sourgrass", "Rumput kerbau"],
] as const;

interface ReadingSpec {
  units: string[];
  ranges: Record<string, { min: number; max: number }>;
}

// Keep this table in sync with mobile/src/lib/measurements.ts.
const READINGS: Record<string, ReadingSpec> = {
  pH: { units: ["pH"], ranges: { pH: { min: 0, max: 14 } } },
  Moisture: { units: ["%"], ranges: { "%": { min: 0, max: 100 } } },
  "Water level": {
    units: ["m", "cm"],
    ranges: { m: { min: 0, max: 20 }, cm: { min: 0, max: 2000 } },
  },
  Turbidity: { units: ["NTU"], ranges: { NTU: { min: 0, max: 1000 } } },
  Temperature: { units: ["°C"], ranges: { "°C": { min: -10, max: 60 } } },
  "Soil depth": { units: ["cm"], ranges: { cm: { min: 0, max: 300 } } },
};

const READING_TYPES = Object.keys(READINGS);

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
- "Fallen debris": fallen branches, logs, rocks, or other loose material.
- "Eroded ground": exposed soil, gullies, or ground loss.
- "Blocked drainage": a drain, culvert, or channel blocked by material.
- "Silt runoff": muddy water or sediment flowing away from a site.
- "Rockfall risk": loose rocks or a slope that appears likely to fall.

Severity:
- "low": minor issue with no obvious immediate risk.
- "medium": needs attention and could become worse.
- "critical": obvious immediate risk to people, roads, water, or property.

Return an empty string for a field when the photo does not support a confident answer.`;

const FLORA_PROMPT = `${BASE_PROMPT}

Flora rules:
- Identify the plant only when it clearly matches one of the catalog species below.
- species_name must be the exact scientific name from the catalog. If no catalog species is a clear match, return an empty string. Never invent a species.
- growth_stage must be one of "Seedling", "Sapling", "Mature", or an empty string.
- health_condition must be one of "Healthy", "Stressed", "Diseased", "Dying", "Dead", or an empty string.
- estimated_count is the number of individual plants of the identified species visible in the photo. Use 0 if you cannot estimate it.
- notes may mention visible leaf colour, damage, pests, or the surrounding plants.

Growth stages:
- "Seedling": small, young, recently established.
- "Sapling": young woody plant, not yet mature.
- "Mature": fully grown plant.

Health conditions:
- "Healthy": normal colour and structure, no visible damage.
- "Stressed": wilting, yellowing, or poor vigour.
- "Diseased": spots, rot, or other signs of disease.
- "Dying": mostly dead or collapsing.
- "Dead": no living tissue visible.

Species catalog:
${SPECIES_CATALOG.map(
  ([scientific, common, malay]) => `- ${scientific} (${common}; Malay: ${malay})`
).join("\n")}`;

const SOIL_WATER_PROMPT = `${BASE_PROMPT}

Soil and water rules:
- Read the value only from a clearly visible meter, gauge, or display. Do not estimate a value from how the ground or water looks.
- reading_type must be one of the types listed below, or an empty string.
- reading_unit must be one of the units allowed for that reading type, or an empty string.
- reading_value must be the number shown on the display, written as text (for example "6.8" or "1.25"). Return an empty string when no value is readable.
- If no display is readable, return empty strings and 0 for confidence.
- notes may say which instrument, gauge, or marker is visible.

Allowed readings:
- "pH": unit "pH", range 0-14.
- "Moisture": unit "%", range 0-100.
- "Water level": unit "m" (0-20) or "cm" (0-2000).
- "Turbidity": unit "NTU", range 0-1000.
- "Temperature": unit "°C", range -10 to 60.
- "Soil depth": unit "cm", range 0-300.`;

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
    species_name: {
      type: "string",
      description:
        "Exact scientific name from the species catalog, or an empty string if no catalog species is a clear match.",
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
    "species_name",
    "growth_stage",
    "health_condition",
    "estimated_count",
    "notes",
    "confidence",
  ],
};

const SOIL_WATER_SCHEMA = {
  type: "object",
  properties: {
    reading_type: {
      type: "string",
      description: `One of ${READING_TYPES.map((type) => `"${type}"`).join(
        ", "
      )}, or an empty string if no meter is readable.`,
    },
    reading_value: {
      type: "string",
      description:
        'The number shown on the meter or gauge, written as text (for example "6.8"), or an empty string if no value is readable.',
    },
    reading_unit: {
      type: "string",
      description:
        'The unit shown on the display (for example "pH", "%", "m", "cm", "NTU", "°C"), or an empty string.',
    },
    notes: NOTES_PROPERTY,
    confidence: CONFIDENCE_PROPERTY,
  },
  required: ["reading_type", "reading_value", "reading_unit", "notes", "confidence"],
};

interface HazardSuggestion {
  title: string;
  hazard_type: string;
  severity: string;
  notes: string;
  confidence: number;
}

interface FloraSuggestion {
  species_name: string;
  growth_stage: string;
  health_condition: string;
  estimated_count: number;
  notes: string;
  confidence: number;
}

interface SoilWaterSuggestion {
  reading_type: string;
  reading_value: number | null;
  reading_unit: string;
  notes: string;
  confidence: number;
}

type Suggestion = HazardSuggestion | FloraSuggestion | SoilWaterSuggestion;

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

function matchSpecies(value: string): string {
  const needle = value.trim().toLowerCase();
  if (!needle) return "";
  const entry = SPECIES_CATALOG.find((names) =>
    names.some((name) => name.toLowerCase() === needle)
  );
  return entry ? entry[0] : "";
}

function parseReadingValue(value: string): number | null {
  // Accept a dot or comma as the decimal separator, and ignore any unit text
  // the model copied from the display.
  const normalised = value.replace(/(\d),(\d)/g, "$1.$2");
  const match = normalised.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
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
    species_name: matchSpecies(cleanText(record.species_name, 80)),
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

function normaliseSoilWater(record: Record<string, unknown>): SoilWaterSuggestion {
  const readingType = cleanText(record.reading_type, 30);
  const type = READING_TYPES.includes(readingType) ? readingType : "";
  const spec = type ? READINGS[type] : null;

  let unit = cleanText(record.reading_unit, 10);
  if (spec && !spec.units.includes(unit)) unit = spec.units[0] ?? "";

  let value = parseReadingValue(cleanText(record.reading_value, 20));
  if (!spec || value === null) {
    value = null;
  } else {
    const range = spec.ranges[unit];
    if (!range || value < range.min || value > range.max) value = null;
  }

  return {
    reading_type: type,
    reading_value: value,
    reading_unit: type ? unit : "",
    notes: cleanText(record.notes, 500),
    confidence: cleanConfidence(record.confidence),
  };
}

function hasContent(recordType: RecordType, suggestion: Suggestion): boolean {
  if (recordType === "hazard") {
    const hazard = suggestion as HazardSuggestion;
    return Boolean(hazard.title || hazard.hazard_type || hazard.severity || hazard.notes);
  }
  if (recordType === "flora") {
    const flora = suggestion as FloraSuggestion;
    return Boolean(
      flora.species_name ||
        flora.growth_stage ||
        flora.health_condition ||
        flora.estimated_count
    );
  }
  const soil = suggestion as SoilWaterSuggestion;
  return Boolean(soil.reading_type || soil.reading_value !== null);
}

function promptFor(recordType: RecordType): string {
  if (recordType === "flora") return FLORA_PROMPT;
  if (recordType === "soil_water") return SOIL_WATER_PROMPT;
  return HAZARD_PROMPT;
}

function schemaFor(recordType: RecordType): unknown {
  if (recordType === "flora") return FLORA_SCHEMA;
  if (recordType === "soil_water") return SOIL_WATER_SCHEMA;
  return HAZARD_SCHEMA;
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

  let body: { recordType?: unknown; imageBase64?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "The request body must be JSON." }, 400);
  }

  const recordType = body.recordType;
  if (recordType !== "hazard" && recordType !== "flora" && recordType !== "soil_water") {
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
    const raw = parseModelJson(text);
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    if (recordType === "flora") suggestion = normaliseFlora(record);
    else if (recordType === "soil_water") suggestion = normaliseSoilWater(record);
    else suggestion = normaliseHazard(record);
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
