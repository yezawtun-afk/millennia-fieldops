"use client";

// Before and after, side by side: the evidence a supervisor needs to close a
// job. Both columns are always present, so a missing "after" photo reads as
// missing work rather than as a layout accident.
import { useI18n } from "@/i18n";

function PhotoGrid({
  urls,
  label,
  emptyLabel,
}: {
  urls: string[];
  /** "Before" or "After", already translated, used in the alt text. */
  label: string;
  emptyLabel: string;
}) {
  const { t } = useI18n();

  if (urls.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-[6px] border border-dashed border-control bg-panel px-3 text-center text-[12px] text-faint">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {urls.map((url, index) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          title={t("Open photo in a new tab")}
          className="block overflow-hidden rounded-[6px] border border-line"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={t("{label} photo {number}", { label, number: index + 1 })}
            className="h-28 w-full object-cover transition-transform hover:scale-[1.02]"
          />
        </a>
      ))}
    </div>
  );
}

export function BeforeAfter({ before, after }: { before: string[]; after: string[] }) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
          {t("Before")}
          <span className="num rounded-full bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            {before.length}
          </span>
        </p>
        <PhotoGrid
          urls={before}
          label={t("Before")}
          emptyLabel={t("No photo was attached to the report.")}
        />
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
          {t("After")}
          <span className="num rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            {after.length}
          </span>
        </p>
        <PhotoGrid
          urls={after}
          label={t("After")}
          emptyLabel={t("Waiting for a photo of the finished work.")}
        />
      </div>
    </div>
  );
}
