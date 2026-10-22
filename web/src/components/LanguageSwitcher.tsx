"use client";

// Language picker. Choosing a language writes a one-year cookie and refreshes
// the current page, so every server-rendered sentence is rebuilt in that
// language. A native <select> keeps it usable with a keyboard and on phones.
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useI18n } from "@/i18n";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/translate";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();

  function choose(next: string) {
    if (!next) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    // The page is server-rendered, so a refresh is what applies the choice.
    router.refresh();
  }

  return (
    <label
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-control bg-sheet pl-2 pr-1 text-[12px] text-muted"
      title={t("Change language")}
    >
      <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
      <span className="sr-only">{t("Language")}</span>
      <select
        value={locale}
        onChange={(event) => choose(event.target.value)}
        aria-label={t("Change language")}
        className="h-7 cursor-pointer rounded-sm bg-transparent pr-1 text-[12px] font-medium text-ink focus:outline-none"
      >
        {LOCALES.map((item) => (
          <option key={item.value} value={item.value}>
            {compact ? item.short : item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export type { Locale };
