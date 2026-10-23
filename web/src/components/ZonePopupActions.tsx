"use client";

// What a supervisor or administrator sees when they click a zone on the site
// map. Zones are created with the drawing tool and removed from here.
//
// Deleting a zone never deletes field records: the foreign key is
// "on delete set null", so the records keep their photos and readings and end
// up with no zone. The confirm sentence says how many records that affects.
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

  function question(): string {
    if (records === 0) return t("Delete this zone? Nothing else is affected.");
    if (records === 1) {
      return t(
        "Delete this zone? Its {count} record will keep its details but have no zone.",
        { count: records }
      );
    }
    return t(
      "Delete this zone? Its {count} records will keep their details but have no zone.",
      { count: records }
    );
  }

  async function remove() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    // Ask for the deleted row back. A delete that the database refuses because
    // of its policies is reported as success with no rows, not as an error.
    const { data: deleted, error: dbError } = await supabase
      .from("zones")
      .delete()
      .eq("id", zoneId)
      .select("id");

    setBusy(false);

    if (dbError) {
      setError(
        dbError.code === "42501"
          ? t("Your account cannot change zones.")
          : dbError.code === "23503"
            ? // Only reachable on a database that has not run 11_zone_control.sql yet.
              t("This zone still has records, so it cannot be deleted.")
            : dbError.message
      );
      return;
    }

    if (!deleted || deleted.length === 0) {
      setError(t("Your account cannot change zones."));
      return;
    }

    map.closePopup();
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="mt-1.5">
        <p className="text-[12px] leading-snug text-muted">{question()}</p>
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
