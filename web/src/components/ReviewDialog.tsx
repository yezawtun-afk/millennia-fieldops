"use client";

// Reviews a record from the overview without leaving the page. The browser's
// native <dialog> gives the focus trap and the Escape key for free; the decision
// itself is the same ReviewPanel the record page uses, so there is one place
// where a record can be approved or rejected.
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useI18n } from "@/i18n";
import { SeverityBadge } from "./Pills";
import type { HazardSeverity } from "@/lib/types";

// The panel is the only thing on the overview that needs the Supabase browser
// client, which is large. Loading it on first open keeps the dashboard light.
const ReviewPanel = dynamic(() => import("./ReviewPanel").then((mod) => mod.ReviewPanel), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-control bg-panel" />,
});

export interface ReviewDialogRecord {
  id: string;
  title: string;
  zoneName: string | null;
  severity: HazardSeverity | null;
  notes: string | null;
  photoUrl: string | null;
  ageLabel: string;
}

export function ReviewDialog({ record }: { record: ReviewDialogRecord }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-control border border-control bg-sheet px-2.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-soft"
      >
        {t("Review now")}
      </button>

      <dialog
        ref={dialogRef}
        className="fieldops-dialog"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        aria-label={t("Review {title}", { title: record.title })}
      >
        <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-ink">{record.title}</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {record.zoneName ?? t("No zone")} · {record.ageLabel}
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

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <div className="flex gap-3 px-4 pt-3">
            {record.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={record.photoUrl}
                alt=""
                className="h-24 w-24 shrink-0 rounded-[6px] border border-line object-cover"
              />
            ) : (
              <span className="h-24 w-24 shrink-0 rounded-[6px] border border-dashed border-control bg-panel" />
            )}
            <div className="min-w-0 text-[13px]">
              <SeverityBadge severity={record.severity} />
              {record.notes ? (
                <p className="mt-2 max-h-16 overflow-y-auto whitespace-pre-wrap leading-relaxed text-muted">
                  {record.notes}
                </p>
              ) : (
                <p className="mt-2 text-faint">{t("No notes were added.")}</p>
              )}
            </div>
          </div>

          <div className="p-4">
            <ReviewPanel recordId={record.id} onDecided={() => setOpen(false)} />
          </div>
        </div>
      </dialog>
    </>
  );
}
