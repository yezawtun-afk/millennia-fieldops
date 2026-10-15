// The sync engine. Uploads queued records (and their photos) to Supabase,
// then removes them from the local outbox.
import { supabase, PHOTO_BUCKET } from "./supabase";
import { listOutbox, markError, removeOutbox } from "./sqlite";
import type { OutboxRecord } from "./types";

export interface SyncResult {
  uploaded: number;
  failed: number;
}

async function uploadPhoto(uri: string, path: string): Promise<string> {
  // Read the local file into an ArrayBuffer, then upload it.
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });

  if (error) throw new Error(error.message);
  return path;
}

async function pushRecord(record: OutboxRecord, userId: string) {
  // 1. Upload the photos and collect their storage paths.
  const photoPaths: string[] = [];
  for (let i = 0; i < record.photos.length; i += 1) {
    const path = `${userId}/${record.localId}/${i}.jpg`;
    photoPaths.push(await uploadPhoto(record.photos[i], path));
  }

  // 2. Insert the record row.
  const { error } = await supabase.from("records").insert({
    type: record.type,
    title: record.title,
    zone_id: record.zone_id,
    observed_date: record.observed_date,
    latitude: record.latitude,
    longitude: record.longitude,
    notes: record.notes,
    photos: photoPaths,
    status: "pending",
    species_name: record.species_name,
    growth_stage: record.growth_stage,
    health_condition: record.health_condition,
    estimated_count: record.estimated_count,
    hazard_type: record.hazard_type,
    severity: record.severity,
    reading_type: record.reading_type,
    reading_value: record.reading_value,
    reading_unit: record.reading_unit,
    submitted_by: userId,
  });

  if (error) throw new Error(error.message);
}

export async function syncOutbox(userId: string): Promise<SyncResult> {
  const rows = await listOutbox();
  const pending = rows.filter((r) => r.status === "pending");

  let uploaded = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      await pushRecord(row.payload, userId);
      await removeOutbox(row.localId);
      uploaded += 1;
    } catch (error) {
      failed += 1;
      await markError(row.localId, error instanceof Error ? error.message : "Unknown upload error");
    }
  }

  return { uploaded, failed };
}
