"use client";

// What an administrator sees when they click a zone on the site map. Zones are
// no longer managed on their own page, so the map is the place to remove one.
//
// A zone cannot be deleted while field records still point at it (the foreign
// key is "on delete restrict"). The record count comes from the page, and the
// database's own refusal is translated into the same sentence as a fallback.
import { useState } from "react";
import { useMap } from "react-leaflet";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n";

export function ZonePopupActions({
  zoneId,
  records,
}: {
  zoneId: string;
  records: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const map = useMap();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (records > 0) {
    return (
      <p className="mt-1 text-[12px] leading-snug text-muted">
        {records === 1
          ? t("This zone still has {count} record, so it cannot be deleted.", { count: records })
          : t("This zone still has {count} records, so it cannot be deleted.", {
              count: records,
            })}
      </p>
    );
  }

  async function remove() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: dbError } = await supabase.from("zones").delete().eq("id", zoneId);

    setBusy(false);

    if (dbError) {
      setError(
        dbError.code === "23503"
          ? t("This zone still has records, so it cannot be deleted.")
          : dbError.message
      );
      return;
    }

    map.closePopup();
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="mt-1.5">
        <p className="text-[12px] leading-snug text-muted">
          {t("Delete this zone? Nothing else is affected.")}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-negative/30 bg-negative-soft px-2 py-1 text-[12px] font-medium text-negative-ink transition-colors hover:bg-negative/10 disabled:opacity-60"
          >
            {t("Delete zone")}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-[12px] text-muted transition-colors hover:text-ink"
          >
            {t("Cancel")}
          </button>
        </div>
        {error ? <p className="mt-1 text-[12px] text-negative-ink">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[12px] font-medium text-negative-ink transition-colors hover:underline"
      >
        {t("Delete zone")}
      </button>
      {error ? <p className="mt-1 text-[12px] text-negative-ink">{error}</p> : null}
    </div>
  );
}
