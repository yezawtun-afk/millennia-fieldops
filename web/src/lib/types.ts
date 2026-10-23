// Shared TypeScript types, matching the Supabase database.

export type UserRole = "field_worker" | "supervisor" | "admin";
export type RecordType = "flora" | "soil_water" | "hazard";
export type RecordStatus = "pending" | "approved" | "rejected";
export type HazardSeverity = "low" | "medium" | "critical";

// pending  = asked for an account, waiting for an administrator
// approved = may use the system
// declined = the request was refused
export type AccountStatus = "pending" | "approved" | "declined";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  // Optional because a database that has not re-run 01_schema.sql yet does not
  // return them; the UI treats a missing status as approved.
  phone?: string | null;
  status?: AccountStatus | null;
  requested_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
}

export interface Zone {
  id: string;
  name: string;
  description: string | null;
  color: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  created_at: string;
}

export interface FieldRecord {
  id: string;
  type: RecordType;
  title: string;
  zone_id: string | null;
  observed_date: string;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  notes: string | null;
  status: RecordStatus;
  supervisor_feedback: string | null;

  species_name: string | null;
  growth_stage: string | null;
  health_condition: string | null;
  estimated_count: number | null;

  hazard_type: string | null;
  severity: HazardSeverity | null;

  reading_type: string | null;
  reading_value: number | null;
  reading_unit: string | null;

  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;

  // Set when the worker finishes an approved hazard job
  // (supabase/12_job_completion.sql). The review status stays "approved".
  completed_at?: string | null;
  completed_by?: string | null;
  completion_note?: string | null;
  completion_photos?: string[];

  // Joined fields (filled by the query helpers).
  zone?: { id: string; name: string } | null;
  submitter?: { id: string; full_name: string } | null;
  reviewer?: { id: string; full_name: string } | null;
  completer?: { id: string; full_name: string } | null;
}

// One row of the append-only activity log (supabase/10_audit_logs.sql).
export interface AuditLog {
  id: number;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity: "record" | "account" | string;
  entity_id: string | null;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  record_id: string | null;
  message: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}

// What the bell in the top bar shows. Field workers hear about decisions on
// their own records; reviewers hear about records waiting for a decision.
export interface WorkerNewsItem {
  id: string;
  recordId: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface ReviewerNewsItem {
  id: string;
  title: string;
  zoneName: string | null;
  createdAt: string;
}

export type News =
  | { kind: "worker"; unread: number; items: WorkerNewsItem[] }
  | { kind: "reviewer"; pending: number; latestAt: string | null; items: ReviewerNewsItem[] };
