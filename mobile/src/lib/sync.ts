// The sync engine. Uploads queued records (and their photos) to Supabase,
// then removes them from the local outbox.
import { supabase } from "./supabase";
import { listOutbox, markError, removeOutbox } from "./sqlite";
import { deletePhoto } from "./photos";
import { uploadRecordPhoto } from "./upload";
import type { OutboxRecord } from "./types";

export interface SyncResult {
  uploaded: number;
  failed: number;
}

async function pushRecord(record: OutboxRecord, userId: string) {
  // 1. Upload the photos and collect their storage paths.
  const photoPaths: string[] = [];
  for (let i = 0; i < record.photos.length; i += 1) {
    const path = `${userId}/${record.localId}/${i}.jpg`;
    photoPaths.push(await uploadRecordPhoto(record.photos[i], path));
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

async function runSync(userId: string): Promise<SyncResult> {
  const rows = await listOutbox();
  // Every finished record is retried, including ones that failed last time, so a
  // one-off network drop heals itself instead of waiting in the queue forever.
  const pending = rows.filter((r) => r.status !== "draft");

  let uploaded = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      await pushRecord(row.payload, userId);
      await removeOutbox(row.localId);
      // The upload succeeded, so the copies on this phone have no job left.
      for (const uri of row.payload.photos) {
        await deletePhoto(uri);
      }
      uploaded += 1;
    } catch (error) {
      failed += 1;
      await markError(row.localId, error instanceof Error ? error.message : "Unknown upload error");
    }
  }

  return { uploaded, failed };
}

// Only one upload run may be in flight at a time. A sync can be started from
// the Home screen, the records list, saving a record and the "connection is
// back" watcher; two runs at once would upload the same record twice.
let inFlight: Promise<SyncResult> | null = null;

// The status badge listens here, so "Syncing..." starts and stops with the real
// upload - including uploads nobody pressed a button for.
export interface SyncEvent {
  running: boolean;
  result?: SyncResult;
}

const listeners = new Set<(event: SyncEvent) => void>();

export function subscribeSync(listener: (event: SyncEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitSync(event: SyncEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A broken listener must never break an upload.
    }
  }
}

export function isSyncing(): boolean {
  return inFlight !== null;
}

export function syncOutbox(userId: string): Promise<SyncResult> {
  if (!inFlight) {
    emitSync({ running: true });
    inFlight = runSync(userId)
      .then((result) => {
        emitSync({ running: false, result });
        return result;
      })
      .catch((error) => {
        emitSync({ running: false });
        throw error;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
