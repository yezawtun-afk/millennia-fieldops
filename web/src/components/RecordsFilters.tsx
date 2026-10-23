"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { btnGhost, selectClass } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { Zone } from "@/lib/types";

// The URL stores the exact timestamps the database compares against, while the
// date inputs show the user's local calendar day.
function toInputDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayStart(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function dayEnd(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export function RecordsFilters({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  // Dates start blank and fill after mount: the server timezone can differ from
  // the browser's, so converting a timestamp during server rendering would
  // produce a different input value and a hydration mismatch.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Keep the controls in sync if the URL changes (e.g. Back button).
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    setFromDate(toInputDate(searchParams.get("dateFrom")));
    setToDate(toInputDate(searchParams.get("dateTo")));
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

  // Keep the range valid without silently discarding the date the user just
  // picked: moving one end past the other pulls the other end along.
  function changeFrom(value: string) {
    const nextTo = value && toDate && value > toDate ? value : toDate;
    setFromDate(value);
    setToDate(nextTo);
    applyDateRange(value, nextTo);
  }

  function changeTo(value: string) {
    const nextFrom = value && fromDate && value < fromDate ? value : fromDate;
    setFromDate(nextFrom);
    setToDate(value);
    applyDateRange(nextFrom, value);
  }

  function applyDateRange(nextFrom: string, nextTo: string) {
    apply({
      dateFrom: nextFrom ? dayStart(nextFrom) : "",
      dateTo: nextTo ? dayEnd(nextTo) : "",
    });
  }

  const hasFilters = [
    "q",
    "type",
    "status",
    "completion",
    "dateFrom",
    "dateTo",
    "severity",
    "zone",
  ].some((key) => searchParams.get(key));

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
          placeholder={t("Search title, species, notes")}
          aria-label={t("Search records")}
          className="h-9 w-full rounded-control border border-control bg-sheet pl-8 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </form>

      <select
        value={searchParams.get("type") ?? ""}
        onChange={(event) => apply({ type: event.target.value, completion: "" })}
        aria-label={t("Filter by type")}
        className={`${selectClass} sm:w-[136px]`}
      >
        <option value="">{t("All types")}</option>
        <option value="flora">{t("Flora")}</option>
        <option value="soil_water">{t("Soil & water")}</option>
        <option value="hazard">{t("Hazard")}</option>
      </select>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(event) => apply({ status: event.target.value, completion: "" })}
        aria-label={t("Filter by status")}
        className={`${selectClass} sm:w-[150px]`}
      >
        <option value="">{t("All statuses")}</option>
        <option value="pending">{t("Pending review")}</option>
        <option value="approved">{t("Approved")}</option>
        <option value="rejected">{t("Rejected")}</option>
      </select>

      <select
        value={searchParams.get("completion") ?? ""}
        onChange={(event) => {
          const completion = event.target.value;
          // A completion is either an open or a finished hazard job, so it
          // cannot sit alongside a different type or review status.
          apply(
            completion
              ? { completion, type: "", status: "" }
              : { completion: "" }
          );
        }}
        aria-label={t("Filter by completion")}
        className={`${selectClass} sm:w-[150px]`}
      >
        <option value="">{t("All")}</option>
        <option value="open">{t("Incomplete")}</option>
        <option value="done">{t("Completed")}</option>
      </select>

      <label className="flex items-center gap-1.5 text-[12px] text-muted">
        <span className="whitespace-nowrap">{t("From")}</span>
        <input
          type="date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(event) => changeFrom(event.target.value)}
          aria-label={t("From date")}
          className="h-9 w-[138px] rounded-control border border-control bg-sheet px-2 text-[12px] text-ink focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex items-center gap-1.5 text-[12px] text-muted">
        <span className="whitespace-nowrap">{t("To")}</span>
        <input
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(event) => changeTo(event.target.value)}
          aria-label={t("To date")}
          className="h-9 w-[138px] rounded-control border border-control bg-sheet px-2 text-[12px] text-ink focus:border-accent focus:outline-none"
        />
      </label>

      <select
        value={searchParams.get("severity") ?? ""}
        onChange={(event) => apply({ severity: event.target.value })}
        aria-label={t("Filter by severity")}
        className={`${selectClass} sm:w-[146px]`}
      >
        <option value="">{t("All severities")}</option>
        <option value="low">{t("Low")}</option>
        <option value="medium">{t("Medium")}</option>
        <option value="critical">{t("Critical")}</option>
      </select>

      <select
        value={searchParams.get("zone") ?? ""}
        onChange={(event) => apply({ zone: event.target.value })}
        aria-label={t("Filter by zone")}
        className={`${selectClass} sm:w-[150px]`}
      >
        <option value="">{t("All zones")}</option>
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
          <X className="h-4 w-4" strokeWidth={1.7} /> {t("Clear filters")}
        </button>
      ) : null}
    </div>
  );
}
