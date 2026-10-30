// Offline outbox stored in SQLite (expo-sqlite).
// Records are written here first, then uploaded by the sync engine.
// A row is either a "draft" (unfinished, never uploaded), "pending" (ready to
// upload) or "error" (the last upload attempt failed).
import * as SQLite from "expo-sqlite";
import type { OutboxRecord, OutboxRow, OutboxStatus } from "./types";

const DB_NAME = "millennia_fieldops.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  const db = await dbPromise;
  await db.execAsync(`
    create table if not exists outbox (
      local_id   text primary key not null,
      payload    text not null,
      status     text not null default 'pending',
      error      text,
      created_at text not null
    );
    create table if not exists last_observation (
      id       text primary key not null,
      payload  text not null,
      saved_at text not null
    );
  `);
  return db;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface Row {
  local_id: string;
  payload: string;
  status: OutboxStatus;
  error: string | null;
  created_at: string;
}

function toOutboxRow(row: Row): OutboxRow {
  return {
    localId: row.local_id,
    payload: JSON.parse(row.payload) as OutboxRecord,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  };
}

// A finished record: it goes straight into the upload queue.
export async function enqueueRecord(record: Omit<OutboxRecord, "localId">): Promise<string> {
  const db = await getDb();
  const localId = makeId();
  const payload: OutboxRecord = { ...record, localId };
  await db.runAsync(
    "insert into outbox (local_id, payload, status, error, created_at) values (?, ?, 'pending', null, ?)",
    localId,
    JSON.stringify(payload),
    new Date().toISOString()
  );
  return localId;
}

// An unfinished record. Saving again with the same localId overwrites the draft.
export async function saveDraft(
  record: Omit<OutboxRecord, "localId">,
  localId?: string
): Promise<string> {
  const db = await getDb();
  const id = localId ?? makeId();
  const payload: OutboxRecord = { ...record, localId: id };
  await db.runAsync(
    `insert into outbox (local_id, payload, status, error, created_at)
     values (?, ?, 'draft', null, ?)
     on conflict (local_id) do update set payload = excluded.payload, error = null`,
    id,
    JSON.stringify(payload),
    new Date().toISOString()
  );
  return id;
}

// Draft -> finished: move it into the upload queue.
export async function markPending(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "update outbox set status = 'pending', error = null where local_id = ?",
    localId
  );
}

export async function listOutbox(): Promise<OutboxRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>("select * from outbox order by created_at asc");
  return rows.map(toOutboxRow);
}

export async function getOutbox(localId: string): Promise<OutboxRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>("select * from outbox where local_id = ?", localId);
  return row ? toOutboxRow(row) : null;
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from outbox where status = 'pending'"
  );
  return row?.count ?? 0;
}

export async function countDrafts(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from outbox where status = 'draft'"
  );
  return row?.count ?? 0;
}

// Records whose last upload attempt failed and that need attention.
export async function countFailed(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from outbox where status = 'error'"
  );
  return row?.count ?? 0;
}

export async function removeOutbox(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("delete from outbox where local_id = ?", localId);
}

export async function markError(localId: string, message: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("update outbox set status = 'error', error = ? where local_id = ?", message, localId);
}

// The record that was submitted last, kept so the next one can start from it.
//
// It cannot be read back from the outbox: an uploaded row is deleted from there
// as soon as it lands on the server. One row is stored, overwritten each time,
// and it lives on the phone so repeating works with no signal at all.
const LAST_OBSERVATION_ID = "last";

export async function rememberObservation(
  record: Omit<OutboxRecord, "localId">
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `insert into last_observation (id, payload, saved_at) values (?, ?, ?)
     on conflict (id) do update set payload = excluded.payload, saved_at = excluded.saved_at`,
    LAST_OBSERVATION_ID,
    JSON.stringify(record),
    new Date().toISOString()
  );
}

export async function getLastObservation(): Promise<Omit<OutboxRecord, "localId"> | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    "select payload from last_observation where id = ?",
    LAST_OBSERVATION_ID
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as Omit<OutboxRecord, "localId">;
  } catch {
    // A row written by an older build may not match today's shape. Better to
    // offer nothing than to fill the form with nonsense.
    return null;
  }
}
