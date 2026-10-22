"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { useI18n } from "@/i18n";

// A page inside the app failed. Keep the frame, explain it in one sentence,
// and leave the two ways out: retry, or go back to the overview.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-negative-soft text-negative">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.7} />
      </span>
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
        {t("This page did not load")}
      </h1>
      <p className="max-w-[46ch] text-[13px] text-muted">
        {t(
          "The server returned an error while building this view. Try again; if it keeps happening, the problem is usually a filter value the database could not read."
        )}
      </p>
      {error.digest ? (
        <p className="font-mono text-[11px] text-faint">
          {t("Reference {code}", { code: error.digest })}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={reset} className={btnPrimary}>
          {t("Try again")}
        </button>
        <Link href="/dashboard" className={btnSecondary}>
          {t("Back to overview")}
        </Link>
      </div>
    </div>
  );
}
