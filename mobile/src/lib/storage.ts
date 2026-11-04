// What this phone is holding, and what of it is safe to throw away.
//
// Photos are copied into the app's own `record-photos` folder before upload
// (see lib/photos.ts) and are deleted as soon as their record reaches Supabase
// (see lib/sync.ts). So a photo that stays behind is one nothing points at any
// more: shot in a form that was abandoned, or left when the app was killed
// between capture and save. This module separates "still needed" from
// "leftover" and only ever deletes the second kind.
//
// Nothing here touches the network. The server copies are never involved.
import { Directory, File, Paths } from "expo-file-system";
import { listOutbox } from "./sqlite";

function photoDir(): Directory {
  return new Directory(Paths.document, "record-photos");
}

// Photos held by a form that has not been saved yet. They belong to no outbox
// row, so without this the cleaner would delete the photo the worker is
// looking at. Screens keep their entry here in step with their own state.
const heldByForms = new Map<string, Set<string>>();

export function holdPhotos(owner: string, uris: string[]): void {
  if (uris.length === 0) heldByForms.delete(owner);
  else heldByForms.set(owner, new Set(uris));
}

// Compare by file name: the same file can be written `file:///a/b.jpg` or
// `/a/b.jpg` depending on where the path came from, and a mismatch here would
// mark a photo in use as leftover.
function keyOf(uri: string): string {
  return uri.split("/").pop() ?? uri;
}

export interface StorageReport {
  /** Everything in the photo folder. */
  photoCount: number;
  photoBytes: number;
  /** Pointed at by a draft, a queued record or an open form. */
  keptCount: number;
  keptBytes: number;
  /** Nothing points at these; deleting them cannot lose a record. */
  leftoverCount: number;
  leftoverBytes: number;
  leftoverUris: string[];
  /** Context for the card, so the worker knows what is waiting to upload. */
  waitingCount: number;
  draftCount: number;
}

export async function scanPhotoStorage(): Promise<StorageReport> {
  const rows = await listOutbox().catch(() => []);

  const referenced = new Set<string>();
  for (const row of rows) {
    for (const uri of row.payload.photos ?? []) referenced.add(keyOf(uri));
  }
  for (const uris of heldByForms.values()) {
    for (const uri of uris) referenced.add(keyOf(uri));
  }

  const report: StorageReport = {
    photoCount: 0,
    photoBytes: 0,
    keptCount: 0,
    keptBytes: 0,
    leftoverCount: 0,
    leftoverBytes: 0,
    leftoverUris: [],
    waitingCount: rows.filter((row) => row.status !== "draft").length,
    draftCount: rows.filter((row) => row.status === "draft").length,
  };

  let entries: File[] = [];
  try {
    const dir = photoDir();
    // The folder only exists once the first photo is taken.
    if (dir.exists) entries = dir.list().filter((entry): entry is File => entry instanceof File);
  } catch {
    return report;
  }

  for (const file of entries) {
    const bytes = file.size ?? 0;
    report.photoCount += 1;
    report.photoBytes += bytes;
    if (referenced.has(file.name)) {
      report.keptCount += 1;
      report.keptBytes += bytes;
    } else {
      report.leftoverCount += 1;
      report.leftoverBytes += bytes;
      report.leftoverUris.push(file.uri);
    }
  }

  return report;
}

export interface ClearResult {
  removed: number;
  failed: number;
  freedBytes: number;
}

// Deletes the files the last scan called leftover. Each file is handled on its
// own, so one that vanished between the scan and the delete (a sync finishing,
// for example) cannot stop the rest.
export async function clearLeftoverPhotos(): Promise<ClearResult> {
  const report = await scanPhotoStorage();
  const folderUri = photoDir().uri;

  let removed = 0;
  let failed = 0;
  let freedBytes = 0;

  for (const uri of report.leftoverUris) {
    try {
      const file = new File(uri);
      // Belt and braces: this function only ever reaches inside its own folder.
      if (!file.uri.startsWith(folderUri)) {
        failed += 1;
        continue;
      }
      const bytes = file.size ?? 0;
      if (file.exists) file.delete();
      removed += 1;
      freedBytes += bytes;
    } catch {
      failed += 1;
    }
  }

  return { removed, failed, freedBytes };
}

// "18 MB", "3.2 MB", "820 KB". One decimal only below 10 MB, where it tells a
// worker something; above that it is noise.
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
