"use client";

import { Download, FileText } from "lucide-react";
import { btnPrimary, btnSecondary } from "@/components/ui";

// Two download links that carry the current filters to /api/export.
export function ExportButtons({ query }: { query: string }) {
  const suffix = query ? `&${query}` : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/api/export?format=csv${suffix}`} className={btnSecondary}>
        <Download className="h-4 w-4" strokeWidth={1.7} /> Export CSV
      </a>
      <a href={`/api/export?format=pdf${suffix}`} className={btnPrimary}>
        <FileText className="h-4 w-4" strokeWidth={1.7} /> Hazard summary PDF
      </a>
    </div>
  );
}
