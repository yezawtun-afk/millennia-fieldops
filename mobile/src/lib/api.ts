// Read helpers that talk to Supabase.
import { supabase } from "./supabase";
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
