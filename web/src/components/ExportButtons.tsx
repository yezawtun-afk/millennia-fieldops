"use client";

import { Download, FileText } from "lucide-react";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { useI18n } from "@/i18n";

// Two download links that carry the current filters to /api/export.
export function ExportButtons({ query }: { query: string }) {
  const { t } = useI18n();
  const suffix = query ? `&${query}` : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/api/export?format=csv${suffix}`} className={btnSecondary}>
        <Download className="h-4 w-4" strokeWidth={1.7} /> {t("Export CSV")}
      </a>
      <a href={`/api/export?format=pdf${suffix}`} className={btnPrimary}>
        <FileText className="h-4 w-4" strokeWidth={1.7} /> {t("Hazard summary PDF")}
      </a>
    </div>
  );
}
