"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n";

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
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Delete the row first: if this fails, the photos are still referenced and
    // nothing is lost. Removing the files first would leave a record pointing
    // at objects that no longer exist.
    const { error: deleteError } = await supabase.from("records").delete().eq("id", recordId);
    if (deleteError) {
      setError(deleteError.message);
      setBusy(false);
      return;
    }

    // Best effort: a storage hiccup must not make the record reappear.
    if (photos.length > 0) {
      await supabase.storage.from("record-photos").remove(photos);
    }

    setBusy(false);
    setConfirming(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-2 text-[12px] text-negative-ink">
        {error}
        <button type="button" className="font-medium underline" onClick={() => setError(null)}>
          {t("Dismiss")}
        </button>
      </span>
    );
  }

  if (!confirming) {
    return compact ? (
      <button
        type="button"
        title={t('Delete "{title}"', { title })}
        aria-label={t('Delete "{title}"', { title })}
        onClick={() => setConfirming(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-control text-muted transition-colors hover:border-negative/40 hover:bg-negative-soft hover:text-negative-ink"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.7} />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-control border border-control bg-sheet px-3.5 text-[13px] font-medium text-negative-ink transition-colors hover:border-negative/40 hover:bg-negative-soft"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.7} /> {t("Delete record")}
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
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-control bg-negative px-2.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {busy ? t("Deleting...") : t("Delete")}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="h-8 rounded-control border border-control px-2.5 text-[12px] font-medium text-muted hover:bg-panel disabled:opacity-60"
      >
        {t("Cancel")}
      </button>
    </span>
  );
}
