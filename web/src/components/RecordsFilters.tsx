"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { btnGhost, selectClass } from "@/components/ui";
import type { Zone } from "@/lib/types";

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
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const hasFilters = ["q", "type", "status", "severity", "zone"].some((key) =>
    searchParams.get(key)
  );

  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q });
        }}
        className="relative w-full sm:w-[260px]"
        role="search"
      >
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          strokeWidth={1.7}
        />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search title, species, notes"
          aria-label="Search records"
          className="h-9 w-full rounded-control border border-control bg-sheet pl-8 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </form>

      <select
        value={searchParams.get("type") ?? ""}
        onChange={(event) => apply({ type: event.target.value })}
        aria-label="Filter by type"
        className={`${selectClass} sm:w-[136px]`}
      >
        <option value="">All types</option>
        <option value="flora">Flora</option>
        <option value="soil_water">Soil &amp; water</option>
        <option value="hazard">Hazard</option>
      </select>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(event) => apply({ status: event.target.value })}
        aria-label="Filter by status"
        className={`${selectClass} sm:w-[150px]`}
      >
        <option value="">All statuses</option>
        <option value="pending">Pending review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      <select
        value={searchParams.get("severity") ?? ""}
        onChange={(event) => apply({ severity: event.target.value })}
        aria-label="Filter by severity"
        className={`${selectClass} sm:w-[146px]`}
      >
        <option value="">All severities</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="critical">Critical</option>
      </select>

      <select
        value={searchParams.get("zone") ?? ""}
        onChange={(event) => apply({ zone: event.target.value })}
        aria-label="Filter by zone"
        className={`${selectClass} sm:w-[150px]`}
      >
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
          className={`${btnGhost} sm:ml-auto`}
        >
          <X className="h-4 w-4" strokeWidth={1.7} /> Clear filters
        </button>
      ) : null}
    </div>
  );
}
