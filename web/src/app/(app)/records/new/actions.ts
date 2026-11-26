"use server";

// Creating a record from the website. The phone queues records in SQLite and
// uploads them later; here the user is already online, so the row is written
// straight away.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { GROWTH_STAGES, HAZARD_TYPES, HEALTH_CONDITIONS, READING_TYPES } from "@/lib/format";
import { defaultUnitFor, validateReading } from "@/lib/measurements";

const BUCKET = "record-photos";
const MAX_PHOTOS = 3;
const TYPES = ["flora", "soil_water", "hazard"];
const SEVERITIES = ["low", "medium", "critical"];

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numeric(value: string): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function createRecord(
  _previous: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const t = await getT();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: t("Your session has expired. Sign in again.") };
  }

  const type = text(formData, "type");
  if (!TYPES.includes(type)) {
    return { error: t("Pick a record type.") };
  }

  const title = text(formData, "title");
  if (title.length < 3) {
    return { error: t("Give the record a title.") };
  }

  const zoneId = text(formData, "zone") || null;

  // The date input is a calendar day in the reader's timezone, so it is
  // assembled as local midnight before being stored as a timestamp.
  const observedRaw = text(formData, "observedDate");
  const observed = observedRaw ? new Date(`${observedRaw}T00:00:00`) : new Date();
  const observedDate = Number.isNaN(observed.getTime())
    ? new Date().toISOString()
    : observed.toISOString();

  const latitude = numeric(text(formData, "latitude"));
  const longitude = numeric(text(formData, "longitude"));
  const located =
    latitude !== null &&
    longitude !== null &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  let speciesName: string | null = null;
  let growthStage: string | null = null;
  let healthCondition: string | null = null;
  let estimatedCount: number | null = null;

  if (type === "flora") {
    speciesName = text(formData, "speciesName") || null;
    const stage = text(formData, "growthStage");
    growthStage = GROWTH_STAGES.includes(stage) ? stage : null;
    const health = text(formData, "healthCondition");
    healthCondition = HEALTH_CONDITIONS.includes(health) ? health : null;
    const count = numeric(text(formData, "estimatedCount"));
    estimatedCount = count !== null && count >= 0 ? Math.round(count) : null;
  }

  let hazardType: string | null = null;
  let severity: string | null = null;

  if (type === "hazard") {
    const hazard = text(formData, "hazardType");
    hazardType = HAZARD_TYPES.includes(hazard) ? hazard : null;
    const chosen = text(formData, "severity");
    severity = SEVERITIES.includes(chosen) ? chosen : null;
  }

  let readingType: string | null = null;
  let readingValue: number | null = null;
  let readingUnit: string | null = null;

  if (type === "soil_water") {
    const chosen = text(formData, "readingType");
    readingType = READING_TYPES.includes(chosen) ? chosen : null;
    const unit = text(formData, "readingUnit") || defaultUnitFor(readingType) || null;
    const raw = text(formData, "readingValue");

    // The same range check the phone applies, so an impossible reading never
    // reaches a supervisor's queue.
    const problem = validateReading(readingType, raw, unit);
    if (problem) {
      return { error: t(problem.key, problem.params) };
    }

    readingValue = Number(raw);
    readingUnit = unit;
  }

  const notes = text(formData, "notes") || null;

  // Photos are optional. They go into the private bucket under the user's own
  // folder, which is the only place the storage policy lets them write.
  const files = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, MAX_PHOTOS);

  const photoPaths: string[] = [];
  const folder = crypto.randomUUID();

  for (const [index, file] of files.entries()) {
    const path = `${user.id}/${folder}/${index}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (error) {
      // Do not leave half an upload behind if the next one fails.
      if (photoPaths.length > 0) {
        await supabase.storage.from(BUCKET).remove(photoPaths);
      }
      return { error: t("The photo could not be uploaded: {message}", { message: error.message }) };
    }
    photoPaths.push(path);
  }

  const { data, error } = await supabase
    .from("records")
    .insert({
      type,
      title,
      zone_id: zoneId,
      observed_date: observedDate,
      latitude: located ? latitude : null,
      longitude: located ? longitude : null,
      notes,
      photos: photoPaths,
      status: "pending",
      species_name: speciesName,
      growth_stage: growthStage,
      health_condition: healthCondition,
      estimated_count: estimatedCount,
      hazard_type: hazardType,
      severity,
      reading_type: readingType,
      reading_value: readingValue,
      reading_unit: readingUnit,
      submitted_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (photoPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(photoPaths);
    }
    return { error: t("The record could not be saved: {message}", { message: error.message }) };
  }

  revalidatePath("/records");
  revalidatePath("/dashboard");
  revalidatePath("/map");
  redirect(`/records/${data.id}`);
}
