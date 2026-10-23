// Shared types, matching the Supabase database.

export type UserRole = "field_worker" | "supervisor" | "admin";
export type RecordType = "flora" | "soil_water" | "hazard";
export type RecordStatus = "pending" | "approved" | "rejected";
export type HazardSeverity = "low" | "medium" | "critical";
export type AccountStatus = "pending" | "approved" | "declined";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  // Optional: a database that has not re-run 01_schema.sql does not return
  // them, and a missing status means the account is approved (as before).
  phone?: string | null;
  status?: AccountStatus | null;
}

export interface Zone {
  id: string;
  name: string;
  description: string | null;
  color: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
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

  // Set when the worker marks an approved hazard as done
  // (supabase/12_job_completion.sql). Approval and completion are separate:
  // status stays "approved" after the work is finished.
  completed_at?: string | null;
  completed_by?: string | null;
  completion_note?: string | null;
  completion_photos?: string[];

  zone?: { id: string; name: string } | null;
  submitter?: { id: string; full_name: string } | null;
  completer?: { id: string; full_name: string } | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  record_id: string | null;
  message: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}

// What we store locally (in SQLite) before a record is uploaded.
export interface OutboxRecord {
  localId: string;
  type: RecordType;
  title: string;
  zone_id: string | null;
  observed_date: string;
  latitude: number | null;
  longitude: number | null;
  /** Reported GPS accuracy in metres; null for older drafts or an unknown fix. */
  gps_accuracy?: number | null;
  notes: string | null;
  photos: string[]; // local file:// URIs

  species_name: string | null;
  growth_stage: string | null;
  health_condition: string | null;
  estimated_count: number | null;

  hazard_type: string | null;
  severity: HazardSeverity | null;

  reading_type: string | null;
  reading_value: number | null;
  reading_unit: string | null;
}

// Local queue state. A draft is unfinished work that is never uploaded until
// the user completes it; pending/error are finished records waiting to upload.
export type OutboxStatus = "draft" | "pending" | "error";

export interface OutboxRow {
  localId: string;
  payload: OutboxRecord;
  status: OutboxStatus;
  error: string | null;
  createdAt: string;
}
