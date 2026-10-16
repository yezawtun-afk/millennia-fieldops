"use client";

import { Download, FileText } from "lucide-react";

// Two download links that carry the current filters to /api/export.
export function ExportButtons({ query }: { query: string }) {
  const suffix = query ? `&${query}` : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/export?format=csv${suffix}`}
        className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
      >
        <Download className="h-4 w-4" /> Export CSV
      </a>
      <a
        href={`/api/export?format=pdf${suffix}`}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
      >
        <FileText className="h-4 w-4" /> Hazard summary PDF
      </a>
    </div>
  );
}
