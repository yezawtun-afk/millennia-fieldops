// Read helpers used by the dashboard pages.
import "server-only";
import { createClient } from "./supabase/server";
import type { FieldRecord, Profile, Zone } from "./types";

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

// Builds the shared query used by the records table and the export files.
export async function queryRecords(filters: RecordFilters = {}): Promise<FieldRecord[]> {
  const supabase = await createClient();
  let query = supabase.from("records").select(RECORD_SELECT).order("created_at", { ascending: false });

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.zoneId) query = query.eq("zone_id", filters.zoneId);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      `title.ilike.${term},species_name.ilike.${term},hazard_type.ilike.${term},reading_type.ilike.${term},notes.ilike.${term}`
    );
  }

  const { data, error } = await query.limit(1000);
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
