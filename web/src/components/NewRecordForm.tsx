"use client";

// The website's version of the phone's "New record" screen. The fields are the
// same, and the photo assist calls the same deployed edge function, so a record
// made in an office and one made in a quarry are reviewed the same way.

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Loader2, LocateFixed, Sparkles, X } from "lucide-react";
import { createRecord } from "@/app/(app)/records/new/actions";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  GROWTH_STAGES,
  HAZARD_TYPES,
  HEALTH_CONDITIONS,
  READING_TYPES,
  TYPE_CHART_COLORS,
} from "@/lib/format";
import { defaultUnitFor, getReadingDefinition } from "@/lib/measurements";
import { SPECIES_STATUS_LABELS, speciesStatusFor } from "@/lib/species";
import { useI18n } from "@/i18n";
import type { RecordType } from "@/lib/types";

const MAX_PHOTOS = 3;
const MAX_BASE64_CHARS = 2_000_000;

const TYPES: { value: RecordType; label: string }[] = [
  { value: "flora", label: "Flora" },
  { value: "soil_water", label: "Soil & water" },
  { value: "hazard", label: "Hazard" },
];

const SEVERITIES = ["low", "medium", "critical"] as const;

// The model's answer arrives untyped, so every field is checked against the
// same option lists the form itself uses before it is allowed into an input.
interface Suggestion {
  title?: unknown;
  species_name?: unknown;
  growth_stage?: unknown;
  health_condition?: unknown;
  estimated_count?: unknown;
  hazard_type?: unknown;
  severity?: unknown;
  notes?: unknown;
  confidence?: unknown;
}

type AiState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; confidence: number | null }
  | { state: "error"; message: string };

function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// A phone photo is several megabytes; the function accepts about 1.5 MB of
// image data. Shrinking on a canvas first keeps the request small and the
// upload fast, and nothing the model needs is lost at 1600px.
async function prepareImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8).replace(/^data:[^;]+;base64,/, "");
}

// The same shrink, but keeping a File for the upload: it turns a 5 MB phone
// photo (or a HEIC the browser can decode) into a small JPEG every browser and
// every later viewer can read.
async function toJpeg(file: File, maxEdge = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    // A format the browser cannot decode is sent untouched rather than dropped.
    return file;
  }
}

export function NewRecordForm({ zones }: { zones: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(createRecord, { error: null });

  const [type, setType] = useState<RecordType>("flora");
  const [title, setTitle] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [observedDate, setObservedDate] = useState("");

  const [speciesName, setSpeciesName] = useState("");
  const [growthStage, setGrowthStage] = useState("");
  const [healthCondition, setHealthCondition] = useState("");
  const [estimatedCount, setEstimatedCount] = useState("");

  const [hazardType, setHazardType] = useState("");
  const [severity, setSeverity] = useState("");

  const [readingType, setReadingType] = useState("");
  const [readingValue, setReadingValue] = useState("");
  const [readingUnit, setReadingUnit] = useState("");

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [photoNames, setPhotoNames] = useState<string[]>([]);

  const [ai, setAi] = useState<AiState>({ state: "idle" });
  const aiInputRef = useRef<HTMLInputElement | null>(null);

  // The day starts blank and fills on the client: the server's clock can be a
  // day behind the reader's, and a fixed value would fail hydration.
  useEffect(() => {
    setObservedDate((current) => current || todayInput());
  }, []);

  const status = speciesStatusFor(speciesName);
  const readingDefinition = getReadingDefinition(readingType);

  function applySuggestion(suggestion: Suggestion) {
    const read = (value: unknown) => (typeof value === "string" ? value.trim() : "");

    const named = read(suggestion.title);
    if (named) setTitle(named);

    if (type === "hazard") {
      const hazard = read(suggestion.hazard_type);
      if (HAZARD_TYPES.includes(hazard)) setHazardType(hazard);
      const chosen = read(suggestion.severity);
      if ((SEVERITIES as readonly string[]).includes(chosen)) setSeverity(chosen);
    } else {
      const species = read(suggestion.species_name);
      if (species) setSpeciesName(species);
      const stage = read(suggestion.growth_stage);
      if (GROWTH_STAGES.includes(stage)) setGrowthStage(stage);
      const health = read(suggestion.health_condition);
      if (HEALTH_CONDITIONS.includes(health)) setHealthCondition(health);
      const count = Number(suggestion.estimated_count);
      if (Number.isFinite(count) && count > 0) setEstimatedCount(String(Math.round(count)));
    }

    // Typed notes win: the assistant never overwrites what the worker wrote.
    const suggested = read(suggestion.notes);
    if (suggested) setNotes((current) => (current.trim() ? current : suggested));
  }

  async function readErrorCode(error: unknown): Promise<string | null> {
    const context = (error as { context?: Response }).context;
    if (!context || typeof context.json !== "function") return null;
    try {
      const body = (await context.json()) as { code?: unknown };
      return typeof body.code === "string" ? body.code : null;
    } catch {
      return null;
    }
  }

  function messageForCode(code: string | null): string {
    switch (code) {
      case "quota_exhausted":
        return t("AI has reached today's limit. Enter the record by hand.");
      case "rate_limited":
        return t("AI is busy. Wait a moment and try again.");
      case "unclear_photo":
        return t("The photo was not clear enough. Try another.");
      case "image_too_large":
        return t("That photo is too large to analyse.");
      case "not_signed_in":
        return t("Sign in again to use AI.");
      default:
        return t("AI could not analyse the photo. Enter the record by hand.");
    }
  }

  async function analyse(file: File) {
    setAi({ state: "loading" });
    try {
      const imageBase64 = await prepareImage(file);
      if (imageBase64.length > MAX_BASE64_CHARS) {
        setAi({ state: "error", message: messageForCode("image_too_large") });
        return;
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setAi({ state: "error", message: messageForCode("not_signed_in") });
        return;
      }

      const { data, error } = await supabase.functions.invoke("analyze-record", {
        body: { recordType: type, imageBase64, mimeType: "image/jpeg" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        setAi({ state: "error", message: messageForCode(await readErrorCode(error)) });
        return;
      }

      const suggestion = (data as { suggestion?: Suggestion } | null)?.suggestion;
      if (!suggestion) {
        setAi({ state: "error", message: messageForCode(null) });
        return;
      }

      applySuggestion(suggestion);

      const raw = Number(suggestion.confidence);
      const confidence = Number.isFinite(raw) ? Math.round(raw <= 1 ? raw * 100 : raw) : null;
      setAi({ state: "done", confidence });
    } catch {
      setAi({ state: "error", message: messageForCode(null) });
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationNote(t("This browser cannot share a location."));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocating(false);
        setLocationNote(null);
      },
      () => {
        setLocating(false);
        setLocationNote(t("Location unavailable. Allow it in your browser, then try again."));
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <section className="rounded-card border border-line bg-sheet p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Record type")}>
          {TYPES.map((option) => {
            const active = type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setType(option.value);
                  setAi({ state: "idle" });
                }}
                aria-pressed={active}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors ${
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-control bg-sheet text-muted hover:border-accent/50 hover:text-ink"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: TYPE_CHART_COLORS[option.value] }}
                  aria-hidden="true"
                />
                {t(option.label)}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[12px] font-medium text-muted">{t("Title")}</span>
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={3}
              maxLength={120}
              placeholder={t("What did you see?")}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">{t("Zone")}</span>
            <select
              name="zone"
              value={zoneId}
              onChange={(event) => setZoneId(event.target.value)}
              className={selectClass}
            >
              <option value="">{t("No zone")}</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              {t("Observed date")}
            </span>
            <input
              type="date"
              name="observedDate"
              value={observedDate}
              onChange={(event) => setObservedDate(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {type === "soil_water" ? (
        <p className="rounded-card border border-line bg-panel px-3 py-2 text-[12px] leading-snug text-muted">
          {t("No AI assist for soil and water: read the instrument directly.")}
        </p>
      ) : (
        <section className="rounded-card border border-line bg-sheet p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => aiInputRef.current?.click()}
              disabled={ai.state === "loading"}
              className={btnSecondary}
            >
              {ai.state === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              ) : (
                <Sparkles className="h-4 w-4" strokeWidth={1.8} />
              )}
              {ai.state === "loading"
                ? t("Reading the photo...")
                : ai.state === "done"
                  ? t("Fill again from another photo")
                  : t("Auto-fill from photo")}
            </button>

            {ai.state === "done" ? (
              <span className="text-[12px] text-muted">
                {ai.confidence === null
                  ? t("Filled from photo")
                  : t("Filled from photo - {value}% confidence", { value: ai.confidence })}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-[12px] leading-snug text-faint">
            {t("The photo is analysed once and not stored. Check every field before saving.")}
          </p>

          {ai.state === "error" ? (
            <p className="mt-2 rounded-control border border-negative/25 bg-negative-soft px-2 py-1.5 text-[12px] leading-snug text-negative-ink">
              {ai.message}
            </p>
          ) : null}

          <input
            ref={aiInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void analyse(file);
            }}
          />
        </section>
      )}

      <section className="rounded-card border border-line bg-sheet p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {type === "flora" ? (
            <>
              <label className="block sm:col-span-2">
                <span className="mb-1 flex items-center gap-2 text-[12px] font-medium text-muted">
                  {t("Species name")}
                  {status ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        status === "invasive"
                          ? "bg-negative-soft text-negative-ink"
                          : status === "introduced"
                            ? "bg-warning-soft text-warning"
                            : "bg-positive-soft text-positive-ink"
                      }`}
                    >
                      {t(SPECIES_STATUS_LABELS[status])}
                    </span>
                  ) : null}
                </span>
                <input
                  name="speciesName"
                  value={speciesName}
                  onChange={(event) => setSpeciesName(event.target.value)}
                  placeholder={t("Scientific name")}
                  className={inputClass}
                />
                {status === "invasive" ? (
                  <span className="mt-1 block text-[11px] text-negative-ink">
                    {t("Invasive in Malaysia. Note the location and how much ground it covers.")}
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-muted">
                  {t("Growth stage")}
                </span>
                <select
                  name="growthStage"
                  value={growthStage}
                  onChange={(event) => setGrowthStage(event.target.value)}
                  className={selectClass}
                >
                  <option value="">{t("Not specified")}</option>
                  {GROWTH_STAGES.filter((stage) => stage !== "Not specified").map((stage) => (
                    <option key={stage} value={stage}>
                      {t(stage)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-muted">
                  {t("Health condition")}
                </span>
                <select
                  name="healthCondition"
                  value={healthCondition}
                  onChange={(event) => setHealthCondition(event.target.value)}
                  className={selectClass}
                >
                  <option value="">{t("Not specified")}</option>
                  {HEALTH_CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {t(condition)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-muted">
                  {t("Estimated count")}
                </span>
                <input
                  type="number"
                  name="estimatedCount"
                  min={0}
                  step={1}
                  value={estimatedCount}
                  onChange={(event) => setEstimatedCount(event.target.value)}
                  placeholder="12"
                  className={inputClass}
                />
              </label>
            </>
          ) : null}

          {type === "hazard" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-muted">
                  {t("Hazard type")}
                </span>
                <select
                  name="hazardType"
                  value={hazardType}
                  onChange={(event) => setHazardType(event.target.value)}
                  className={selectClass}
                >
                  <option value="">{t("Not specified")}</option>
                  {HAZARD_TYPES.map((hazard) => (
                    <option key={hazard} value={hazard}>
                      {t(hazard)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-muted">
                  {t("Severity")}
                </span>
                <select
                  name="severity"
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                  className={selectClass}
                >
                  <option value="">{t("Not specified")}</option>
                  <option value="low">{t("Low")}</option>
                  <option value="medium">{t("Medium")}</option>
                  <option value="critical">{t("Critical")}</option>
                </select>
              </label>
            </>
          ) : null}

          {type === "soil_water" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-muted">
                  {t("Reading type")}
                </span>
                <select
                  name="readingType"
                  value={readingType}
                  onChange={(event) => {
                    const next = event.target.value;
                    setReadingType(next);
                    setReadingUnit(defaultUnitFor(next));
                  }}
                  className={selectClass}
                >
                  <option value="">{t("Choose a reading")}</option>
                  {READING_TYPES.map((reading) => (
                    <option key={reading} value={reading}>
                      {t(reading)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-[1fr_88px] gap-2">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-muted">
                    {t("Value")}
                  </span>
                  <input
                    type="number"
                    step="any"
                    name="readingValue"
                    value={readingValue}
                    onChange={(event) => setReadingValue(event.target.value)}
                    placeholder={readingDefinition?.example ?? ""}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-muted">
                    {t("Unit")}
                  </span>
                  <select
                    name="readingUnit"
                    value={readingUnit}
                    onChange={(event) => setReadingUnit(event.target.value)}
                    className={selectClass}
                  >
                    {(readingDefinition?.units ?? []).length === 0 ? (
                      <option value="">-</option>
                    ) : (
                      readingDefinition?.units.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              {readingDefinition ? (
                <p className="text-[11px] leading-snug text-faint sm:col-span-2">
                  {t(readingDefinition.hint)}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-muted">{t("Location")}</span>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className={`${btnGhost} px-2`}
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                ) : (
                  <LocateFixed className="h-4 w-4" strokeWidth={1.8} />
                )}
                {t("Use my location")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                name="latitude"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                inputMode="decimal"
                placeholder={t("Latitude")}
                aria-label={t("Latitude")}
                className={inputClass}
              />
              <input
                name="longitude"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                inputMode="decimal"
                placeholder={t("Longitude")}
                aria-label={t("Longitude")}
                className={inputClass}
              />
            </div>
            {locationNote ? (
              <p className="mt-1 text-[11px] leading-snug text-muted">{locationNote}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-sheet p-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted">{t("Notes")}</span>
          <textarea
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder={t("Anything the photo does not show: access, weather, what you were doing.")}
            className={textareaClass}
          />
        </label>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${btnSecondary} cursor-pointer`}>
              <Camera className="h-4 w-4" strokeWidth={1.8} />
              {t("Add photos")}
              <input
                type="file"
                name="photos"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const picked = Array.from(input.files ?? []).slice(0, MAX_PHOTOS);
                  if (picked.length === 0) return;
                  void (async () => {
                    const prepared = await Promise.all(picked.map((file) => toJpeg(file)));
                    // Replace what the form will submit with the smaller files.
                    // A browser without DataTransfer keeps the originals.
                    try {
                      const transfer = new DataTransfer();
                      prepared.forEach((file) => transfer.items.add(file));
                      input.files = transfer.files;
                    } catch {
                      // Leaving the input as it was is safe: the originals upload.
                    }
                    setPhotoNames(prepared.map((file) => file.name));
                  })();
                }}
              />
            </label>
            <span className="text-[12px] text-muted">
              {t("Up to {count} photos, optional.", { count: MAX_PHOTOS })}
            </span>
          </div>

          {photoNames.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {photoNames.map((name) => (
                <li
                  key={name}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] text-ink"
                >
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-card border border-negative/25 bg-negative-soft px-3 py-2 text-[13px] text-negative-ink"
        >
          <X className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Link href="/records" className={btnGhost}>
          {t("Cancel")}
        </Link>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : null}
          {pending ? t("Saving...") : t("Save record")}
        </button>
      </div>
    </form>
  );
}
