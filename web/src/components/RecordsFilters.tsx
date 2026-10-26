"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { btnGhost, btnSecondary, selectClass } from "@/components/ui";
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

// A chip carries the value, not the filter's name: "Hazard" and "Lakeview
// Wetland" already say what they are.
interface Chip {
  key: string;
  label: string;
  clear: () => void;
}

export function RecordsFilters({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  // Dates start blank and fill after mount: the server timezone can differ from
  // the browser's, so converting a timestamp during server rendering would
  // produce a different input value and a hydration mismatch.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Keep the controls in sync if the URL changes (e.g. Back button).
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    setFromDate(toInputDate(searchParams.get("dateFrom")));
    setToDate(toInputDate(searchParams.get("dateTo")));
  }, [searchParams]);

  // A click outside the panel, or Escape, puts the toolbar back to rest.
  useEffect(() => {
    if (!panelOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

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

  function clearDates() {
    setFromDate("");
    setToDate("");
    apply({ dateFrom: "", dateTo: "" });
  }

  function clearAll() {
    setPanelOpen(false);
    setFromDate("");
    setToDate("");
    router.push(pathname);
  }

  const type = searchParams.get("type") ?? "";
  const status = searchParams.get("status") ?? "";
  const completion = searchParams.get("completion") ?? "";
  const severity = searchParams.get("severity") ?? "";
  const zoneId = searchParams.get("zone") ?? "";

  const typeOptions = [
    { value: "flora", label: t("Flora") },
    { value: "soil_water", label: t("Soil & water") },
    { value: "hazard", label: t("Hazard") },
  ];
  const statusOptions = [
    { value: "pending", label: t("Pending review") },
    { value: "approved", label: t("Approved") },
    { value: "rejected", label: t("Rejected") },
  ];
  const completionOptions = [
    { value: "open", label: t("Incomplete") },
    { value: "done", label: t("Completed") },
  ];
  const severityOptions = [
    { value: "low", label: t("Low") },
    { value: "medium", label: t("Medium") },
    { value: "critical", label: t("Critical") },
  ];

  const localeTag = locale === "zh" ? "zh-CN" : locale === "ms" ? "ms-MY" : "en-GB";

  // A range chip names the days the way the reader writes them. The year only
  // appears when it is not this year, so the common case stays short.
  function shortDate(value: string): string {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString(localeTag, {
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  }

  function dateChipLabel(): string {
    if (fromDate && toDate) return `${shortDate(fromDate)} – ${shortDate(toDate)}`;
    if (fromDate) return `${t("From")} ${shortDate(fromDate)}`;
    return `${t("To")} ${shortDate(toDate)}`;
  }

  const chips: Chip[] = [];
  if (type) {
    chips.push({
      key: "type",
      label: typeOptions.find((option) => option.value === type)?.label ?? type,
      clear: () => apply({ type: "" }),
    });
  }
  if (status) {
    chips.push({
      key: "status",
      label: statusOptions.find((option) => option.value === status)?.label ?? status,
      clear: () => apply({ status: "" }),
    });
  }
  if (completion) {
    chips.push({
      key: "completion",
      label:
        completionOptions.find((option) => option.value === completion)?.label ?? completion,
      clear: () => apply({ completion: "" }),
    });
  }
  if (severity) {
    chips.push({
      key: "severity",
      label: severityOptions.find((option) => option.value === severity)?.label ?? severity,
      clear: () => apply({ severity: "" }),
    });
  }
  if (zoneId) {
    chips.push({
      key: "zone",
      label: zones.find((zone) => zone.id === zoneId)?.name ?? t("Zone"),
      clear: () => apply({ zone: "" }),
    });
  }
  if (fromDate || toDate) {
    chips.push({ key: "dates", label: dateChipLabel(), clear: clearDates });
  }

  const activeCount = chips.length;
  const hasFilters = Boolean(q) || activeCount > 0;

  return (
    <div className="mb-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q });
          }}
          className="relative w-full lg:w-[260px]"
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
            className="h-9 w-full rounded-control border border-control bg-sheet pl-8 pr-8 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                apply({ q: "" });
              }}
              aria-label={t("Clear search")}
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-faint hover:bg-panel hover:text-ink"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          ) : null}
        </form>

        <div className="flex h-9 items-center gap-1 rounded-control border border-control bg-sheet px-2 text-[12px] text-muted">
          <span className="shrink-0">{t("From")}</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => changeFrom(event.target.value)}
            aria-label={t("From date")}
            className="h-7 w-[112px] rounded-[4px] bg-transparent px-1 text-[12px] text-ink focus:outline-none"
          />
          <span className="text-control" aria-hidden="true">
            –
          </span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => changeTo(event.target.value)}
            aria-label={t("To date")}
            className="h-7 w-[112px] rounded-[4px] bg-transparent px-1 text-[12px] text-ink focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 lg:ml-auto">
          <div className="relative" ref={panelRef}>
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              aria-expanded={panelOpen}
              aria-haspopup="dialog"
              className={`${btnSecondary} pr-2.5`}
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
              {t("Filters")}
              {activeCount > 0 ? (
                <span className="num inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-soft px-1 text-[11px] font-semibold text-accent">
                  {activeCount}
                </span>
              ) : null}
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted transition-transform ${panelOpen ? "rotate-180" : ""}`}
                strokeWidth={1.8}
              />
            </button>

            {panelOpen ? (
              <div
                role="dialog"
                aria-label={t("Filters")}
                className="absolute right-0 z-40 mt-1.5 w-[min(420px,calc(100vw-2rem))] rounded-card border border-line bg-sheet p-3 shadow-[0_18px_48px_rgb(20_24_27_/_0.16)]"
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted">{t("Type")}</span>
                    <select
                      value={type}
                      onChange={(event) =>
                        apply({ type: event.target.value, completion: "" })
                      }
                      className={selectClass}
                    >
                      <option value="">{t("All types")}</option>
                      {typeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted">
                      {t("Status")}
                    </span>
                    <select
                      value={status}
                      onChange={(event) =>
                        apply({ status: event.target.value, completion: "" })
                      }
                      className={selectClass}
                    >
                      <option value="">{t("All statuses")}</option>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted">
                      {t("Severity")}
                    </span>
                    <select
                      value={severity}
                      onChange={(event) => apply({ severity: event.target.value })}
                      className={selectClass}
                    >
                      <option value="">{t("All severities")}</option>
                      {severityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted">
                      {t("Zone")}
                    </span>
                    <select
                      value={zoneId}
                      onChange={(event) => apply({ zone: event.target.value })}
                      className={selectClass}
                    >
                      <option value="">{t("All zones")}</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-muted">
                      {t("Completion")}
                    </span>
                    <select
                      value={completion}
                      onChange={(event) => {
                        const next = event.target.value;
                        // A completion is either an open or a finished hazard
                        // job, so it cannot sit alongside another type or
                        // review status.
                        apply(next ? { completion: next, type: "", status: "" } : { completion: "" });
                      }}
                      className={selectClass}
                    >
                      <option value="">{t("All")}</option>
                      {completionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule pt-3">
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={!hasFilters}
                    className={`${btnGhost} px-2 disabled:opacity-40`}
                  >
                    {t("Clear all")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className={btnSecondary}
                  >
                    {t("Done")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {hasFilters ? (
            <button type="button" onClick={clearAll} className={`${btnGhost} px-2`}>
              <X className="h-4 w-4" strokeWidth={1.7} /> {t("Clear")}
            </button>
          ) : null}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              title={t("Remove filter")}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-panel pl-2.5 pr-1.5 text-[11px] font-medium text-ink transition-colors hover:border-control hover:bg-frame-soft"
            >
              {chip.label}
              <X className="h-3 w-3 text-muted" strokeWidth={2} />
              <span className="sr-only">{t("Remove filter")}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
