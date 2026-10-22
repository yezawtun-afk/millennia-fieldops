"use client";

// Gives client components the current language. The locale is decided by the
// server (from the `locale` cookie) and handed down, so the first paint and the
// client agree and switching languages does not flash English.
import { createContext, useCallback, useContext, useMemo } from "react";
import { translate, type Locale, type TranslateParams } from "./translate";

interface I18nValue {
  locale: Locale;
  t: (text: string, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = useCallback(
    (text: string, params?: TranslateParams) => translate(locale, text, params),
    [locale]
  );

  const value = useMemo<I18nValue>(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export type { Locale, TranslateParams };
