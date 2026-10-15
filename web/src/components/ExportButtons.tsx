"use client";

import { Download, FileText } from "lucide-react";

// Two download links that carry the current filters to /api/export.
export function ExportButtons({ query }: { query: string }) {
  const suffix = query ? `&${query}` : "";

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/api/export?format=csv${suffix}`}
        className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:border-primary hover:text-primary"
      >
        <Download size={15} /> Export CSV
      </a>
      <a
        href={`/api/export?format=pdf${suffix}`}
        className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark"
      >
        <FileText size={15} /> Hazard summary PDF
      </a>
    </div>
  );
}
