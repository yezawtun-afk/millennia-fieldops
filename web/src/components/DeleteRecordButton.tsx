"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Deletes a record. Administrators only - the database enforces this
 * (policy `records_delete_admin`), so hiding the button is just good manners.
 *
 * `compact` renders a trash icon for the records table; the default renders a
 * labelled button for the record detail page.
 */
export function DeleteRecordButton({
  recordId,
  title,
  photos = [],
  redirectTo,
  compact = false,
}: {
  recordId: string;
  title: string;
  photos?: string[];
  /** Where to go once the record is gone (used by the detail page). */
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Clear the photos first so the bucket does not keep orphaned files.
    // Best effort: a storage hiccup must not stop the record itself going away.
    if (photos.length > 0) {
      await supabase.storage.from("record-photos").remove(photos);
    }

    const { error: deleteError } = await supabase.from("records").delete().eq("id", recordId);
    if (deleteError) {
      setError(deleteError.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    setConfirming(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-rejected">
        {error}
        <button type="button" className="font-semibold underline" onClick={() => setError(null)}>
          Dismiss
        </button>
      </span>
    );
  }

  if (!confirming) {
    return compact ? (
      <button
        type="button"
        title={`Delete "${title}"`}
        aria-label={`Delete "${title}"`}
        onClick={() => setConfirming(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:border-rejected/40 hover:bg-rejected-soft hover:text-rejected"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-rejected/40 bg-white px-3 py-2 text-sm font-semibold text-rejected hover:bg-rejected-soft"
      >
        <Trash2 className="h-4 w-4" /> Delete record
      </button>
    );
  }

  // Confirmation step - deleting cannot be undone, so it always takes two clicks.
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-rejected px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {busy ? "Deleting..." : "Delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-page disabled:opacity-60"
      >
        Cancel
      </button>
    </span>
  );
}
