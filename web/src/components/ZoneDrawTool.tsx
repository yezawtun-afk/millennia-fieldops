"use client";

// The "Add zone" tool drawn over the site map. It only shapes the click: the
// circle preview and the saved row are handled by LeafletMap and the zones
// table. Administrators only - the database refuses anyone else anyway.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, btnSecondary, inputClass } from "@/components/ui";
import { useI18n } from "@/i18n";

// The colours already used by the seeded zones, so a new zone looks related.
const COLOURS = ["#1f6b4a", "#16a34a", "#f59e0b", "#dc2626", "#0284c7", "#7c5ce0"];

export function ZoneDrawTool({
  drawing,
  centre,
  radius,
  colour,
  onStart,
  onCancel,
  onRadiusChange,
  onColourChange,
  onSaved,
}: {
  drawing: boolean;
  centre: { lat: number; lng: number } | null;
  radius: number;
  colour: string;
  onStart: () => void;
  onCancel: () => void;
  onRadiusChange: (radius: number) => void;
  onColourChange: (colour: string) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Every time the tool opens it starts empty.
  useEffect(() => {
    if (drawing) {
      setName("");
      setError(null);
    }
  }, [drawing]);

  if (!drawing) {
    return (
      <button
        type="button"
        onClick={onStart}
        className="absolute right-3 top-3 z-[900] flex h-9 items-center gap-1.5 rounded-control border border-control bg-sheet px-3 text-[13px] font-medium text-ink shadow-sm transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" strokeWidth={1.8} />
        {t("Add zone")}
      </button>
    );
  }

  async function save() {
    if (!centre) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: dbError } = await supabase.from("zones").insert({
      name: name.trim(),
      description: null,
      color: colour,
      center_lat: centre.lat,
      center_lng: centre.lng,
      radius_m: radius,
    });

    setBusy(false);
    if (dbError) {
      setError(`${t("Could not save the zone.")} ${dbError.message}`);
      return;
    }

    onSaved();
    router.refresh();
  }

  const ready = Boolean(centre) && name.trim().length > 0;

  return (
    <div className="absolute right-3 top-3 z-[900] w-[280px] max-w-[calc(100%-1.5rem)] rounded-card border border-line bg-sheet p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">{t("Add a zone")}</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("Cancel")}
          className="-mr-1 -mt-1 rounded-md p-1 text-muted transition-colors hover:bg-panel hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      <p className="mt-1 text-[12px] leading-snug text-muted">
        {centre
          ? t("Centre {lat}, {lng}", {
              lat: centre.lat.toFixed(5),
              lng: centre.lng.toFixed(5),
            })
          : t("Click the map to place the centre.")}
      </p>

      <label className="mt-3 block text-[12px] font-medium text-muted">
        <span className="flex items-center justify-between">
          {t("Radius")}
          <span className="font-normal tabular-nums text-ink">{radius} m</span>
        </span>
        <input
          type="range"
          min={50}
          max={500}
          step={10}
          value={radius}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
          className="mt-1 w-full accent-accent"
        />
      </label>

      <label className="mt-2 block text-[12px] font-medium text-muted">
        {t("Name")}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("Zone name")}
          className={`${inputClass} mt-1`}
        />
      </label>

      <div className="mt-3">
        <p className="text-[12px] font-medium text-muted">{t("Colour")}</p>
        <div className="mt-1 flex gap-1.5">
          {COLOURS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => onColourChange(swatch)}
              aria-label={t("Use {colour}", { colour: swatch })}
              aria-pressed={colour === swatch}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                colour === swatch ? "border-ink" : "border-transparent"
              }`}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-2 rounded-control border border-negative/25 bg-negative-soft px-2 py-1.5 text-[12px] text-negative-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!ready || busy}
          className={`${btnPrimary} flex-1 disabled:opacity-60`}
        >
          {t("Save zone")}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          {t("Cancel")}
        </button>
      </div>
    </div>
  );
}
