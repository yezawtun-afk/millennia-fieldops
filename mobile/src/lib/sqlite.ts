// Offline outbox stored in SQLite (expo-sqlite).
// Records are written here first, then uploaded by the sync engine.
import * as SQLite from "expo-sqlite";
import type { OutboxRecord, OutboxRow } from "./types";

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
  `);
  return db;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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

export async function listOutbox(): Promise<OutboxRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    local_id: string;
    payload: string;
    status: "pending" | "error";
    error: string | null;
    created_at: string;
  }>("select * from outbox order by created_at asc");

  return rows.map((row) => ({
    localId: row.local_id,
    payload: JSON.parse(row.payload) as OutboxRecord,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  }));
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from outbox where status = 'pending'"
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

export async function retry(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("update outbox set status = 'pending', error = null where local_id = ?", localId);
}
