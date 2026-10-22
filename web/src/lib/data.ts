// Read helpers used by the dashboard pages.
import "server-only";
import { createClient } from "./supabase/server";
import type { AuditLog, FieldRecord, Profile, Zone } from "./types";

const RECORD_SELECT = `
  *,
  zone:zones ( id, name ),
  submitter:profiles!records_submitted_by_fkey ( id, full_name ),
  reviewer:profiles!records_reviewed_by_fkey ( id, full_name )
`;

export interface RecordFilters {
  q?: string;
  type?: string;
  status?: string;
  severity?: string;
  zoneId?: string;
}

// PostgREST reads the inside of an `or=` filter as syntax, so commas,
// parentheses and quotes in a search term have to be quoted and escaped or the
// whole request fails.
function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Builds the shared query used by the records table and the export files.
export async function queryRecords(filters: RecordFilters = {}): Promise<FieldRecord[]> {
  const supabase = await createClient();
  let query = supabase.from("records").select(RECORD_SELECT).order("created_at", { ascending: false });

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.zoneId) query = query.eq("zone_id", filters.zoneId);
  if (filters.q) {
    const term = quoteFilterValue(`%${filters.q}%`);
    query = query.or(
      [
        `title.ilike.${term}`,
        `species_name.ilike.${term}`,
        `hazard_type.ilike.${term}`,
        `reading_type.ilike.${term}`,
        `notes.ilike.${term}`,
      ].join(",")
    );
  }

  const { data, error } = await query.limit(1000);
  if (error) throw new Error(error.message);
  return (data as unknown as FieldRecord[]) ?? [];
}

// Exact counts, so the dashboard figures do not depend on the 1000-row cap.
export async function countRecords(filters: RecordFilters = {}): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from("records").select("id", { count: "exact", head: true });

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.zoneId) query = query.eq("zone_id", filters.zoneId);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// The oldest records still waiting, for the dashboard review queue.
export async function getPendingQueue(limit = 3): Promise<FieldRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(RECORD_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as FieldRecord[]) ?? [];
}

export async function getRecord(id: string): Promise<FieldRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("records").select(RECORD_SELECT).eq("id", id).single();
  if (error) return null;
  return data as unknown as FieldRecord;
}

export async function getZones(): Promise<Zone[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("zones").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as Zone[]) ?? [];
}

export async function getUsers(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return (data as Profile[]) ?? [];
}

export interface AuditQuery {
  action?: string;
  limit?: number;
}

// Newest first. Returns a setup flag instead of throwing when the audit table
// has not been created yet, so the page can explain what to run.
export async function getAuditLogs(
  options: AuditQuery = {}
): Promise<{ rows: AuditLog[]; missingTable: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, actor_name, action, entity, entity_id, summary, details, created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.action) query = query.eq("action", options.action);

  const { data, error } = await query;
  if (error) {
    // PostgREST reports an unknown table with PGRST205 or 42P01.
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { rows: [], missingTable: true };
    }
    throw new Error(error.message);
  }
  return { rows: (data as unknown as AuditLog[]) ?? [], missingTable: false };
}
