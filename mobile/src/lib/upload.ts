// Upload helpers shared by the sync engine and the finish-job screen.
//
// Photos are read from a local file:// URI and written into the private
// record-photos bucket. The storage policy only allows a signed-in user to
// write inside their own `{userId}/...` folder, so every path built by a caller
// must start with the user's id.
import { supabase, PHOTO_BUCKET } from "./supabase";

export async function uploadRecordPhoto(uri: string, path: string): Promise<string> {
  // Read the local file into an ArrayBuffer, then upload it.
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });

  if (error) throw new Error(error.message);
  return path;
}

// Best-effort cleanup: an orphaned file is harmless, but a failed completion
// must not leave photos behind that no record points at.
export async function removeRecordPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  } catch {
    // ignore
  }
}
