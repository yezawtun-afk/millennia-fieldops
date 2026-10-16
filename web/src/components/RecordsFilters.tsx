"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Zone } from "@/lib/types";

const selectClass =
  "rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary";

export function RecordsFilters({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // Keep the text box in sync if the URL changes (e.g. Back button).
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = ["q", "type", "status", "severity", "zone"].some((k) => searchParams.get(k));

  return (
    <div className="mb-4 grid gap-2 rounded-lg border border-line bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="relative block sm:col-span-2 lg:col-span-1"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, species, notes..."
          className="w-full rounded-md border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </form>

      <select value={searchParams.get("type") ?? ""} onChange={(e) => apply({ type: e.target.value })} className={selectClass}>
        <option value="">All types</option>
        <option value="flora">Flora</option>
        <option value="soil_water">Soil/Water</option>
        <option value="hazard">Hazard</option>
      </select>

      <select value={searchParams.get("status") ?? ""} onChange={(e) => apply({ status: e.target.value })} className={selectClass}>
        <option value="">All statuses</option>
        <option value="pending">Pending review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      <select value={searchParams.get("severity") ?? ""} onChange={(e) => apply({ severity: e.target.value })} className={selectClass}>
        <option value="">All severities</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="critical">Critical</option>
      </select>

      <select value={searchParams.get("zone") ?? ""} onChange={(e) => apply({ zone: e.target.value })} className={selectClass}>
        <option value="">All zones</option>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
          </option>
        ))}
      </select>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="flex items-center gap-1 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-muted hover:text-ink"
        >
          <X className="h-4 w-4" /> Clear
        </button>
      ) : null}
    </div>
  );
}
