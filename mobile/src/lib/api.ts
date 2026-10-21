// Read helpers that talk to Supabase.
import { supabase, PHOTO_BUCKET } from "./supabase";
import type { AppNotification, FieldRecord, Zone } from "./types";

const RECORD_SELECT = "*, zone:zones ( id, name )";

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
