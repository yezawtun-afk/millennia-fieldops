"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import type { Zone } from "@/lib/types";

const EMPTY = {
  name: "",
  description: "",
  color: "#1f6b4a",
  center_lat: "2.9125",
  center_lng: "101.8435",
  radius_m: "150",
};

export function ZonesManager({ initialZones }: { initialZones: Zone[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
    setError(null);
  }

  function startEdit(zone: Zone) {
    setEditingId(zone.id);
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
    if (!confirm(`Delete zone "${zone.name}"? Records will keep their data but lose the zone link.`)) return;
    const supabase = createClient();
    const { error: dbError } = await supabase.from("zones").delete().eq("id", zone.id);
    if (dbError) {
      alert(dbError.message);
      return;
    }
    router.refresh();
  }

  const inputClass =
    "w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <h2 className="mb-3 text-sm font-semibold text-ink">{editingId ? "Edit zone" : "Add a zone"}</h2>
        {error ? (
          <p className="mb-3 rounded-md border border-rejected/30 bg-rejected-soft px-3 py-2 text-sm text-rejected">
            {error}
          </p>
        ) : null}

        <form onSubmit={save} className="space-y-3">
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <input
                required
                value={form.center_lat}
                onChange={(e) => setForm({ ...form, center_lat: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Longitude">
              <input
                required
                value={form.center_lng}
                onChange={(e) => setForm({ ...form, center_lng: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Radius (m)">
              <input
                required
                value={form.radius_m}
                onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Colour">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-[38px] w-full rounded-md border border-line"
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Save changes" : "Add zone"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold text-ink">Zones ({initialZones.length})</h2>
        <ul className="divide-y divide-line">
          {initialZones.map((zone) => (
            <li key={zone.id} className="flex items-center gap-3 py-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: zone.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{zone.name}</p>
                <p className="truncate text-xs text-muted">
                  {zone.center_lat.toFixed(4)}, {zone.center_lng.toFixed(4)} - r {zone.radius_m} m
                  {zone.description ? ` - ${zone.description}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(zone)}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(zone)}
                aria-label="Delete zone"
                className="rounded-md border border-line p-2 text-rejected hover:bg-rejected-soft"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
