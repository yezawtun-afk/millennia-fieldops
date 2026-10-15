// Turns stored photo paths into short-lived signed URLs so private bucket
// photos can be shown in the dashboard.
import "server-only";
import { createClient } from "./supabase/server";

const BUCKET = "record-photos";

export async function signPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  const clean = paths.filter((p) => p && !p.startsWith("http")).map(stripBucket);
  if (clean.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(clean, 60 * 30);

  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map[`${BUCKET}/${item.path}`] = item.signedUrl;
  }
  return map;
}

// Also keep any rows that already store a full URL working.
export function stripBucket(path: string): string {
  return path.replace(/^record-photos\//, "");
}

export async function signOne(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const map = await signPhotoUrls([path]);
  return map[`${BUCKET}/${stripBucket(path)}`] ?? null;
}
