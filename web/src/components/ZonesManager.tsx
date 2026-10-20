"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, btnPrimary, btnSecondary, inputClass as fieldClass } from "@/components/ui";
import type { Zone } from "@/lib/types";

const EMPTY = {
  name: "",
  description: "",
  color: "#1f6b4a",
  center_lat: "2.752615639977973",
  center_lng: "101.90646329852517",
  radius_m: "150",
};

export function ZonesManager({ initialZones }: { initialZones: Zone[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
    setError(null);
  }

  function startEdit(zone: Zone) {
    setEditingId(zone.id);
    setNotice(null);
    setForm({
      name: zone.name,
      description: zone.description ?? "",
      color: zone.color,
      center_lat: String(zone.center_lat),
      center_lng: String(zone.center_lng),
      radius_m: String(zone.radius_m),
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      center_lat: Number(form.center_lat),
      center_lng: Number(form.center_lng),
      radius_m: Number(form.radius_m),
    };

    const { error: dbError } = editingId
      ? await supabase.from("zones").update(payload).eq("id", editingId)
      : await supabase.from("zones").insert(payload);

    if (dbError) {
      setError(dbError.message);
      setBusy(false);
      return;
    }

    reset();
    setBusy(false);
    router.refresh();
  }

  async function remove(zone: Zone) {
    setNotice(null);
    setError(null);
    const supabase = createClient();

    // A zone cannot be deleted while records point at it (foreign key is
    // restrict), so check first and explain instead of failing on click.
    const { count, error: countError } = await supabase
      .from("records")
      .select("id", { count: "exact", head: true })
      .eq("zone_id", zone.id);

    if (countError) {
      setNotice(countError.message);
      return;
    }

    if ((count ?? 0) > 0) {
      setNotice(
        `"${zone.name}" still has ${count} record${count === 1 ? "" : "s"}. Reassign or delete those records before deleting the zone.`
      );
      return;
    }

    if (!confirm(`Delete zone "${zone.name}"? It has no records, so nothing else is affected.`)) {
      return;
    }

    const { error: dbError } = await supabase.from("zones").delete().eq("id", zone.id);
    if (dbError) {
      setNotice(dbError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="h-fit p-4">
        <h2 className="text-[14px] font-semibold text-ink">
          {editingId ? "Edit zone" : "Add a zone"}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted">
          The centre and radius are used to place records on the map.
        </p>
        {error ? (
          <p className="mt-3 rounded-control border border-negative/25 bg-negative-soft px-3 py-2 text-[12px] text-negative-ink">
            {error}
          </p>
        ) : null}

        <form onSubmit={save} className="mt-3 space-y-3">
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={fieldClass}
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className={fieldClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <input
                required
                value={form.center_lat}
                onChange={(event) => setForm({ ...form, center_lat: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Longitude">
              <input
                required
                value={form.center_lng}
                onChange={(event) => setForm({ ...form, center_lng: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Radius (m)">
              <input
                required
                value={form.radius_m}
                onChange={(event) => setForm({ ...form, radius_m: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Colour">
              <input
                type="color"
                value={form.color}
                onChange={(event) => setForm({ ...form, color: event.target.value })}
                className="h-9 w-full rounded-control border border-control bg-sheet"
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={`${btnPrimary} flex-1`}>
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Save changes" : "Add zone"}
            </button>
            {editingId ? (
              <button type="button" onClick={reset} className={btnSecondary}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card className="h-fit overflow-hidden">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink">Zones</h2>
          <span className="text-[12px] text-muted">{initialZones.length} configured</span>
        </div>

        {notice ? (
          <p className="border-b border-rule bg-warning-soft px-4 py-2 text-[12px] text-warning-ink">
            {notice}
          </p>
        ) : null}

        {initialZones.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-muted">
            No zones yet. Add the first one with the form on the left.
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {initialZones.map((zone) => (
              <li key={zone.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: zone.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{zone.name}</p>
                  <p className="truncate text-[12px] text-muted">
                    {zone.center_lat.toFixed(4)}, {zone.center_lng.toFixed(4)} · radius{" "}
                    {zone.radius_m} m{zone.description ? ` · ${zone.description}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(zone)}
                  className="h-8 rounded-control border border-control px-2.5 text-[12px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(zone)}
                  aria-label={`Delete ${zone.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-control border border-control text-muted transition-colors hover:border-negative/40 hover:bg-negative-soft hover:text-negative-ink"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-medium text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
