// Read helpers used by the dashboard pages.
import "server-only";
import { createClient } from "./supabase/server";
import type { AuditLog, FieldRecord, News, Profile, Zone } from "./types";

const RECORD_SELECT = `
  *,
  zone:zones ( id, name ),
  submitter:profiles!records_submitted_by_fkey ( id, full_name ),
  reviewer:profiles!records_reviewed_by_fkey ( id, full_name ),
  completer:profiles!records_completed_by_fkey ( id, full_name ),
  assignee:profiles!records_assigned_to_fkey ( id, full_name ),
  closer:profiles!records_closed_by_fkey ( id, full_name )
`;

export interface RecordFilters {
  q?: string;
  type?: string;
  status?: string;
  severity?: string;
  zoneId?: string;
  /**
   * Work-order state. "open" = still to fix, "verify" = fixed but not yet
   * verified, "done" = verified and closed. Each one is a stage of the same
   * approved hazard, so it replaces the type and status filters.
   */
  completion?: string;
  /** ISO timestamps for the first and last moment of the chosen local days. */
  dateFrom?: string;
  dateTo?: string;
}

// The three stages of the repair loop, in one place so the list, the counts and
// the export cannot drift apart. Rejected hazards never enter the loop.
function isWorkStage(completion: string | undefined): completion is "open" | "verify" | "done" {
  return completion === "open" || completion === "verify" || completion === "done";
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

  if (isWorkStage(filters.completion)) {
    // A work stage belongs to an approved hazard, so it replaces the type and
    // status filters instead of combining with them.
    query = query.eq("type", "hazard").eq("status", "approved");
    if (filters.completion === "open") {
      query = query.is("completed_at", null).is("closed_at", null);
    } else if (filters.completion === "verify") {
      query = query.not("completed_at", "is", null).is("closed_at", null);
    } else {
      query = query.not("closed_at", "is", null);
    }
  } else {
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.status) query = query.eq("status", filters.status);
  }
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.zoneId) query = query.eq("zone_id", filters.zoneId);
  if (filters.dateFrom) query = query.gte("observed_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("observed_date", filters.dateTo);
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

  if (isWorkStage(filters.completion)) {
    query = query.eq("type", "hazard").eq("status", "approved");
    if (filters.completion === "open") {
      query = query.is("completed_at", null).is("closed_at", null);
    } else if (filters.completion === "verify") {
      query = query.not("completed_at", "is", null).is("closed_at", null);
    } else {
      query = query.not("closed_at", "is", null);
    }
  } else {
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.status) query = query.eq("status", filters.status);
  }
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.zoneId) query = query.eq("zone_id", filters.zoneId);
  if (filters.dateFrom) query = query.gte("observed_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("observed_date", filters.dateTo);

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

// The records a supervisor should look at before anything else: pending
// hazards rated critical, oldest first. Severity only exists on hazards, so
// this list is hazard-only by design.
export async function getUrgentQueue(limit = 3): Promise<FieldRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(RECORD_SELECT)
    .eq("status", "pending")
    .eq("type", "hazard")
    .eq("severity", "critical")
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

// Names for a small set of ids, used to label the people who made repair
// attempts that were sent back. A missing id (a deleted account) is simply
// absent from the map; the caller falls back to a generic label.
export async function getProfileNames(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  if (error) throw new Error(error.message);

  const names: Record<string, string> = {};
  for (const row of (data as Pick<Profile, "id" | "full_name">[]) ?? []) {
    names[row.id] = row.full_name;
  }
  return names;
}

// Only an active, approved field worker can be handed remediation work: the
// database function enforces the same rule, so the picker and the rule agree.
export async function getFieldWorkers(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "field_worker")
    .eq("is_active", true)
    .eq("status", "approved")
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data as Profile[]) ?? [];
}

// The supervisor's repair queue: fixed jobs waiting for a decision, oldest
// finish first, so nothing sits unverified while newer work jumps ahead.
export async function getVerificationQueue(limit = 4): Promise<FieldRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(RECORD_SELECT)
    .eq("type", "hazard")
    .eq("status", "approved")
    .not("completed_at", "is", null)
    .is("closed_at", null)
    .order("completed_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as FieldRecord[]) ?? [];
}

export interface RemediationCounts {
  /** Open approved hazards with nobody assigned. */
  unassigned: number;
  /** Assigned, not yet fixed. */
  assigned: number;
  /** Fixed, waiting for a supervisor to verify. */
  awaiting: number;
  /** Past the due date and not closed. */
  overdue: number;
}

// Four small head-counts for the dashboard block. They are separate queries so
// the numbers stay exact beyond the 1000-row read cap.
export async function countRemediation(): Promise<RemediationCounts> {
  const supabase = await createClient();
  const openHazard = () =>
    supabase
      .from("records")
      .select("id", { count: "exact", head: true })
      .eq("type", "hazard")
      .eq("status", "approved")
      .is("closed_at", null);

  const today = new Date().toISOString().slice(0, 10);

  const [unassigned, assigned, awaiting, overdue] = await Promise.all([
    openHazard().is("assigned_to", null).is("completed_at", null),
    openHazard().not("assigned_to", "is", null).is("completed_at", null),
    openHazard().not("completed_at", "is", null),
    openHazard().lt("due_on", today),
  ]);

  return {
    unassigned: unassigned.count ?? 0,
    assigned: assigned.count ?? 0,
    awaiting: awaiting.count ?? 0,
    overdue: overdue.count ?? 0,
  };
}

// The bell in the top bar. A field worker sees the decisions made on their own
// records; a reviewer sees what has arrived and is waiting for a decision.
// Everything here is data the user is already allowed to read, so the bell adds
// no tables and no policies.
export async function getNews(profile: Profile): Promise<News> {
  const supabase = await createClient();

  if (profile.role === "supervisor" || profile.role === "admin") {
    const [count, latest, queue] = await Promise.all([
      supabase
        .from("records")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("records")
        .select("created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("records")
        .select("id, title, created_at, zone:zones ( name )")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(3),
    ]);

    const rows =
      (queue.data as unknown as {
        id: string;
        title: string;
        created_at: string;
        zone: { name: string } | null;
      }[]) ?? [];

    return {
      kind: "reviewer",
      pending: count.count ?? 0,
      latestAt: latest.data?.created_at ?? null,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        zoneName: row.zone?.name ?? null,
        createdAt: row.created_at,
      })),
    };
  }

  const [count, latest] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null),
    supabase
      .from("notifications")
      .select("id, record_id, message, read_at, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const rows =
    (latest.data as unknown as {
      id: string;
      record_id: string | null;
      message: string;
      read_at: string | null;
      created_at: string;
    }[]) ?? [];

  return {
    kind: "worker",
    unread: count.count ?? 0,
    items: rows.map((row) => ({
      id: row.id,
      recordId: row.record_id,
      message: row.message,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
  };
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
