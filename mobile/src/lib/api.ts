// Read helpers that talk to Supabase.
import { supabase, PHOTO_BUCKET } from "./supabase";
import type {
  AppNotification,
  FieldRecord,
  RecordStatus,
  RecordType,
  Zone,
} from "./types";

const RECORD_SELECT =
  "*, zone:zones ( id, name ), submitter:profiles!records_submitted_by_fkey ( id, full_name ), completer:profiles!records_completed_by_fkey ( id, full_name ), assignee:profiles!records_assigned_to_fkey ( id, full_name ), closer:profiles!records_closed_by_fkey ( id, full_name )";

export async function fetchZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from("zones").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as Zone[]) ?? [];
}

// A field worker's own reports plus the jobs a supervisor has assigned to them.
// The two sets are disjoint in practice (you are rarely assigned your own
// hazard), but the query does not assume that.
export async function fetchMyRecords(userId: string): Promise<FieldRecord[]> {
  const { data, error } = await supabase
    .from("records")
    .select(RECORD_SELECT)
    .or(`submitted_by.eq.${userId},assigned_to.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as FieldRecord[]) ?? [];
}

// ---- Side panel counts ----------------------------------------------------
// Three numbers for the side panel: what I captured today, how much of my work
// is still waiting for a supervisor, and the hazard jobs assigned to me that
// are not done. One narrow read with no joins - the panel opens often and must
// never feel heavy.
//
// "Captured today" follows created_at, when the record reached the server, so
// something captured offline today counts on the day it uploads. Mixing the
// phone's queue into this number would put two clocks under one label.
export interface SidebarSummary {
  capturedToday: number;
  waitingReview: number;
  assigned: number;
}

interface SummaryRow {
  submitted_by: string | null;
  assigned_to: string | null;
  status: RecordStatus;
  type: RecordType;
  created_at: string;
  completed_at: string | null;
  closed_at: string | null;
}

export async function fetchSidebarSummary(userId: string): Promise<SidebarSummary> {
  const { data, error } = await supabase
    .from("records")
    .select("submitted_by, assigned_to, status, type, created_at, completed_at, closed_at")
    .or(`submitted_by.eq.${userId},assigned_to.eq.${userId}`);
  if (error) throw new Error(error.message);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return ((data ?? []) as SummaryRow[]).reduce<SidebarSummary>(
    (acc, row) => {
      if (row.submitted_by === userId) {
        if (row.status === "pending") acc.waitingReview += 1;
        if (new Date(row.created_at) >= startOfDay) acc.capturedToday += 1;
      }
      // The same rule the app uses for "Assigned tasks": a job is mine to fix
      // until it is fixed or closed. Re-assigning it moves it to someone else.
      if (
        row.assigned_to === userId &&
        row.type === "hazard" &&
        row.status === "approved" &&
        !row.completed_at &&
        !row.closed_at
      ) {
        acc.assigned += 1;
      }
      return acc;
    },
    { capturedToday: 0, waitingReview: 0, assigned: 0 }
  );
}

export async function fetchRecord(id: string): Promise<FieldRecord | null> {
  const { data, error } = await supabase.from("records").select(RECORD_SELECT).eq("id", id).single();
  if (error) return null;
  return data as unknown as FieldRecord;
}

// Every record for the site map. The database lets any active account read all
// records and zones (policies records_select / zones_select), so a field worker
// sees the same picture as a supervisor - only the actions differ.
export async function fetchAllRecords(): Promise<FieldRecord[]> {
  const { data, error } = await supabase
    .from("records")
    .select(RECORD_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as FieldRecord[]) ?? [];
}

// ---- Supervisor review ----------------------------------------------------
// Supervisors and administrators may read every record and update the review
// fields (policies records_select / records_update_reviewer). The database
// trigger notify_on_review then tells the field worker.
export async function fetchPendingRecords(): Promise<FieldRecord[]> {
  const { data, error } = await supabase
    .from("records")
    .select(RECORD_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as FieldRecord[]) ?? [];
}

// Just the number, for the "waiting for review" shortcut on Home.
export async function countPendingReviews(): Promise<number> {
  const { count, error } = await supabase
    .from("records")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function reviewRecord(
  id: string,
  decision: "approved" | "rejected",
  feedback: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to review a record.");

  const { error } = await supabase
    .from("records")
    .update({
      status: decision,
      supervisor_feedback: feedback.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as AppNotification[]) ?? [];
}

// Turns stored photo paths into temporary signed URLs for display.
export async function signPhotoUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from("record-photos")
    .createSignedUrls(paths, 60 * 60);
  if (error || !data) return [];
  return data.map((item) => item.signedUrl).filter((url): url is string => Boolean(url));
}

// Deletes one of your own records. The database only allows this while the
// record is still 'pending' (policy records_delete_own_pending), so a record
// that a supervisor already reviewed is safe from the field app.
export async function deleteRecord(id: string, photos: string[] = []): Promise<void> {
  // Row first: if the delete is refused (the record was reviewed), nothing has
  // been removed. Clearing the files first would leave a record pointing at
  // photos that no longer exist.
  const { error } = await supabase.from("records").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Photos second, best effort: an orphaned file is harmless, a broken
  // reference is not.
  if (photos.length > 0) {
    try {
      await supabase.storage.from(PHOTO_BUCKET).remove(photos);
    } catch {
      // ignore
    }
  }
}

// ---- Finishing a hazard job ------------------------------------------------
// The database function is the gatekeeper: it checks that the caller submitted
// the record, that it is an approved hazard, and that it is not already done.
// The app only sends the note and the paths of photos that were already
// uploaded to the worker's own folder (see lib/upload.ts).
export async function completeRecord(
  id: string,
  note: string | null,
  photoPaths: string[]
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("complete_record", {
    p_record_id: id,
    p_note: note,
    p_photos: photoPaths,
  });
  return error ? { error: error.message } : {};
}

// ---- Phone sign-in --------------------------------------------------------
// Supabase Auth only knows email addresses (its phone provider needs a paid SMS
// provider and a one-time code). The web dashboard exposes
// POST /api/auth/login, which turns "phone + password" into a normal session;
// the app then stores the tokens with supabase.auth.setSession.
//
// EXPO_PUBLIC_WEB_URL is baked into the JavaScript bundle, so changing it means
// rebuilding or publishing an update.
const DEFAULT_WEB_URL = "https://millennia-fieldops-rewrite.vercel.app";

export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? DEFAULT_WEB_URL).replace(/\/+$/, "");

export interface PhoneSignInResult {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  code?: "pending" | "declined" | "inactive";
}

export async function signInWithPhone(
  identifier: string,
  password: string
): Promise<PhoneSignInResult> {
  let response: Response;
  try {
    response = await fetch(`${WEB_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
  } catch {
    return {
      error: "Could not reach the server. Check your internet connection and try again.",
    };
  }

  try {
    return (await response.json()) as PhoneSignInResult;
  } catch {
    return { error: "The server sent an unexpected answer. Try again in a moment." };
  }
}

// ---- Account requests -----------------------------------------------------
// The request is created by the web dashboard, not by the app, so it needs no
// email confirmation and always starts as pending. Phone is required; email is
// optional and a placeholder is generated on the server when it is empty.
export interface AccountRequestInput {
  full_name: string;
  phone: string;
  email?: string;
  password: string;
}

export async function requestAccount(
  input: AccountRequestInput
): Promise<{ ok?: boolean; error?: string }> {
  let response: Response;
  try {
    response = await fetch(`${WEB_URL}/api/auth/request-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return {
      error: "Could not reach the server. Check your internet connection and try again.",
    };
  }

  let payload: { ok?: boolean; error?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // fall through to the generic message
  }

  if (!response.ok || !payload.ok) {
    return { error: payload.error ?? "Could not send the request. Try again in a moment." };
  }
  return { ok: true };
}

// ---- Own profile ----------------------------------------------------------
// Only the display name is safe to change from the app. Role, status, email
// and phone are restored by the protect_columns trigger (phone is also a way
// to sign in), so an administrator changes those from the web dashboard.
export async function updateDisplayName(userId: string, fullName: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save your name.");
}

export async function changePassword(password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: error.message } : {};
}
