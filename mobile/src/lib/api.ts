// Read helpers that talk to Supabase.
import { supabase, PHOTO_BUCKET } from "./supabase";
import type { AppNotification, FieldRecord, Zone } from "./types";

const RECORD_SELECT =
  "*, zone:zones ( id, name ), submitter:profiles!records_submitted_by_fkey ( id, full_name ), completer:profiles!records_completed_by_fkey ( id, full_name )";

export async function fetchZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from("zones").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as Zone[]) ?? [];
}

export async function fetchMyRecords(userId: string): Promise<FieldRecord[]> {
  const { data, error } = await supabase
    .from("records")
    .select(RECORD_SELECT)
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as FieldRecord[]) ?? [];
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
