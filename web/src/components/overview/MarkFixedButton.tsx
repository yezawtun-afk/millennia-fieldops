"use client";

// "Mark fixed" from the overview: the supervisor checks the after photo that
// the worker uploaded and closes the job. Closing is the only thing that takes
// a hazard out of the health score, so this button is where the number recovers.
//
// It opens the browser's native <dialog> instead of closing on the first click,
// even though the database would allow it: closing a job is the one action on
// the overview that moves the score, and a stray tap on a list should not do it.
// The same verify_close() function backs the record page, so the rules live in
// one place.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { btnGhost, btnPrimary, textareaClass } from "@/components/ui";
import { useI18n } from "@/i18n";

export function MarkFixedButton({
  recordId,
  title,
  worker,
  finishedLabel,
  photoUrl,
}: {
  recordId: string;
  title: string;
  /** Who did the work, already resolved to a name on the server. */
  worker: string | null;
  /** How long ago the worker marked it done, already translated. */
  finishedLabel: string;
  /** The after photo, signed server-side. */
  photoUrl: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function closeJob() {
    setBusy(true);
    setError(null);

    // Loaded on demand: the Supabase client is the heaviest thing on this page,
    // and a supervisor who never presses the button should never download it.
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("verify_close", {
      p_record_id: recordId,
      p_note: note.trim() || null,
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setOpen(false);
    setNote("");
    // The page is a server component: this refetches it, so the row disappears
    // and the health score changes without a full page load.
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-positive/35 bg-positive-soft px-2.5 text-[12px] font-medium text-positive-ink transition-colors hover:border-positive/70"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2} />
        {t("Mark fixed")}
      </button>

      <dialog
        ref={dialogRef}
        className="fieldops-dialog"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        aria-label={t("Mark fixed")}
      >
        <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-ink">{title}</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {t("Fixed {when} by {name}", {
                when: finishedLabel,
                name: worker ?? t("a field worker"),
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-panel hover:text-ink"
            aria-label={t("Close")}
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex gap-3">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <a
                href={photoUrl}
                target="_blank"
                rel="noreferrer"
                title={t("Open photo in a new tab")}
                className="block shrink-0 overflow-hidden rounded-[6px] border border-line"
              >
                <img src={photoUrl} alt="" className="h-24 w-24 object-cover" />
              </a>
            ) : (
              <span className="h-24 w-24 shrink-0 rounded-[6px] border border-dashed border-control bg-panel" />
            )}
            <p className="min-w-0 text-[13px] leading-relaxed text-muted">
              {t(
                "The worker has marked this job done. Closing it takes the hazard out of the health score."
              )}
            </p>
          </div>

          {error ? (
            <p className="mt-3 rounded-control border border-negative/25 bg-negative-soft px-3 py-2 text-[12px] text-negative-ink">
              {error}
            </p>
          ) : null}

          <label className="mt-3 block text-[11px] font-medium text-muted">
            {t("Close note (optional)")}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              className={`${textareaClass} mt-1`}
            />
          </label>

          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={closeJob} disabled={busy} className={btnPrimary}>
              <Check className="h-4 w-4" strokeWidth={2} />
              {busy ? t("Closing...") : t("Mark fixed")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
