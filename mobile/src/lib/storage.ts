// How much room the phone's copy of the photos takes.
//
// Photos are copied into the app's own document folder before upload (see
// lib/photos.ts) and stay there because drafts and queued records point at
// them. That makes this "space this app is using", not a cache that can be
// thrown away: the side panel reports it and never clears it.
import { Directory, Paths } from "expo-file-system";

function photoDir(): Directory {
  return new Directory(Paths.document, "record-photos");
}

// Bytes held by the stored photos. Synchronous but cheap: the folder is flat,
// so this is one directory read. Any read failure means "unknown" (0), never a
// crash in the panel.
export function photoStorageBytes(): number {
  try {
    const dir = photoDir();
    if (!dir.exists) return 0;
    return dir.size ?? 0;
  } catch {
    return 0;
  }
}

// "18 MB", "3.2 MB", "820 KB". One decimal only below 10 MB, where it tells a
// worker something; above that it is noise.
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = Math.round(bytes / 1024);
  return `${Math.max(0, kb)} KB`;
}
