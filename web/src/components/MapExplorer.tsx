"use client";

// The site map with its filter panel. Filtering happens here, on the client, so
// a filter never reloads the page and never remounts Leaflet: what you were
// looking at stays where it was.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { MapView } from "@/components/MapView";
import type { MapMarker, MapZone } from "@/components/MapView";
import { btnGhost, btnSecondary, selectClass } from "@/components/ui";
import { useI18n } from "@/i18n";

// Every filter starts empty, which means "show everything". Keeping them in one
// object makes "clear all" a single assignment.
interface Filters {
  q: string;
  type: string;
  status: string;
  severity: string;
  zone: string;
  completion: string;
  /** Local calendar days, as the date inputs show them (YYYY-MM-DD). */
  from: string;
  to: string;
}

const NO_FILTERS: Filters = {
  q: "",
  type: "",
  status: "",
  severity: "",
  zone: "",
  completion: "",
  from: "",
  to: "",
};

function dayStartMs(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function dayEndMs(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

// A chip carries the value, not the filter's name: "Hazard" and "Lakeview
// Wetland" already say what they are.
interface Chip {
  key: keyof Filters;
  label: string;
  clear: () => void;
}

export function MapExplorer({
  markers,
  zones,
  canManageZones = false,
}: {
  markers: MapMarker[];
  zones: MapZone[];
  canManageZones?: boolean;
}) {
  const { locale, t } = useI18n();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

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

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  // A completion is a stage of an approved hazard, so it cannot sit alongside
  // another type or review status. Choosing one clears the other two, exactly
  // as the Records page does.
  function setCompletion(value: string) {
    setFilters((current) => ({
      ...current,
      completion: value,
      ...(value ? { type: "", status: "" } : {}),
    }));
  }

  function setTypeOrStatus(key: "type" | "status", value: string) {
    setFilters((current) => ({ ...current, [key]: value, completion: "" }));
  }

  const visible = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    const fromMs = filters.from ? dayStartMs(filters.from) : null;
    const toMs = filters.to ? dayEndMs(filters.to) : null;

    return markers.filter((marker) => {
      const meta = marker.filter;
      if (!meta) return true;

      if (query && !meta.search.includes(query)) return false;
      if (filters.type && meta.type !== filters.type) return false;
      if (filters.status && meta.status !== filters.status) return false;
      if (filters.severity && meta.severity !== filters.severity) return false;
      if (filters.zone && meta.zoneId !== filters.zone) return false;
      if (filters.completion && meta.completion !== filters.completion) return false;

      if (fromMs !== null || toMs !== null) {
        const observed = new Date(meta.observedDate).getTime();
        if (Number.isNaN(observed)) return false;
        if (fromMs !== null && observed < fromMs) return false;
        if (toMs !== null && observed > toMs) return false;
      }

      return true;
    });
  }, [markers, filters]);

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
    { value: "verify", label: t("Awaiting verification") },
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
    if (filters.from && filters.to)
      return `${shortDate(filters.from)} – ${shortDate(filters.to)}`;
    if (filters.from) return `${t("From")} ${shortDate(filters.from)}`;
    return `${t("To")} ${shortDate(filters.to)}`;
  }

  const chips: Chip[] = [];
  if (filters.q) {
    chips.push({
      key: "q",
      label: filters.q,
      clear: () => set("q", ""),
    });
  }
  if (filters.type) {
    chips.push({
      key: "type",
      label: typeOptions.find((option) => option.value === filters.type)?.label ?? filters.type,
      clear: () => set("type", ""),
    });
  }
  if (filters.status) {
    chips.push({
      key: "status",
      label:
        statusOptions.find((option) => option.value === filters.status)?.label ?? filters.status,
      clear: () => set("status", ""),
    });
  }
  if (filters.completion) {
    chips.push({
      key: "completion",
      label:
        completionOptions.find((option) => option.value === filters.completion)?.label ??
        filters.completion,
      clear: () => set("completion", ""),
    });
  }
  if (filters.severity) {
    chips.push({
      key: "severity",
      label:
        severityOptions.find((option) => option.value === filters.severity)?.label ??
        filters.severity,
      clear: () => set("severity", ""),
    });
  }
  if (filters.zone) {
    chips.push({
      key: "zone",
      label: zones.find((zone) => zone.id === filters.zone)?.name ?? t("Zone"),
      clear: () => set("zone", ""),
    });
  }
  if (filters.from || filters.to) {
    chips.push({ key: "from", label: dateChipLabel(), clear: () => clearDates() });
  }

  function clearDates() {
    setFilters((current) => ({ ...current, from: "", to: "" }));
  }

  const activeCount = chips.length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
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
            {t("Add filter")}
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
              className="absolute left-0 z-40 mt-1.5 w-[min(440px,calc(100vw-2rem))] rounded-card border border-line bg-sheet p-3 shadow-[0_18px_48px_rgb(20_24_27_/_0.16)]"
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    {t("Search records")}
                  </span>
                  <input
                    value={filters.q}
                    onChange={(event) => set("q", event.target.value)}
                    placeholder={t("Search title, species, notes")}
                    aria-label={t("Search records")}
                    className="h-9 w-full rounded-control border border-control bg-sheet px-2.5 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">{t("Type")}</span>
                  <select
                    value={filters.type}
                    onChange={(event) => setTypeOrStatus("type", event.target.value)}
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
                    value={filters.status}
                    onChange={(event) => setTypeOrStatus("status", event.target.value)}
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
                    value={filters.severity}
                    onChange={(event) => set("severity", event.target.value)}
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
                    value={filters.zone}
                    onChange={(event) => set("zone", event.target.value)}
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
                    value={filters.completion}
                    onChange={(event) => setCompletion(event.target.value)}
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

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    {t("From date")}
                  </span>
                  <input
                    type="date"
                    value={filters.from}
                    max={filters.to || undefined}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilters((current) => ({
                        ...current,
                        from: value,
                        // Keep the range valid without discarding the date the
                        // user just picked: pull the other end along.
                        to: value && current.to && value > current.to ? value : current.to,
                      }));
                    }}
                    aria-label={t("From date")}
                    className="h-9 w-full rounded-control border border-control bg-sheet px-2 text-[12px] text-ink focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    {t("To date")}
                  </span>
                  <input
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilters((current) => ({
                        ...current,
                        to: value,
                        from:
                          value && current.from && value < current.from ? value : current.from,
                      }));
                    }}
                    aria-label={t("To date")}
                    className="h-9 w-full rounded-control border border-control bg-sheet px-2 text-[12px] text-ink focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule pt-3">
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  disabled={activeCount === 0}
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

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                title={t("Remove filter")}
                className="inline-flex h-7 max-w-[220px] items-center gap-1 rounded-full border border-line bg-panel pl-2.5 pr-1.5 text-[11px] font-medium text-ink transition-colors hover:border-control hover:bg-frame-soft"
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-3 w-3 shrink-0 text-muted" strokeWidth={2} />
                <span className="sr-only">{t("Remove filter")}</span>
              </button>
            ))}
          </div>
        ) : null}

        <span className="ml-auto whitespace-nowrap text-[12px] text-muted">
          {t("Showing {count} of {total} records", {
            count: visible.length,
            total: markers.length,
          })}
        </span>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-sheet">
        <MapView markers={visible} zones={zones} canManageZones={canManageZones} />
      </div>
    </>
  );
}
