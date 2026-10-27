// Three-language support for the app: English (default), Malay and Simplified
// Chinese.
//
// The English sentence is the key. `t("Sign in")` looks the sentence up in the
// chosen language and falls back to English when a translation is missing, so
// a new string can never leave a blank screen.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ms } from "./ms";
import { zh } from "./zh";

export type Locale = "en" | "ms" | "zh";

export const LOCALES: { value: Locale; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "ms", label: "Bahasa Melayu", short: "BM" },
  { value: "zh", label: "简体中文", short: "中文" },
];

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en: {},
  ms,
  zh,
};

const STORAGE_KEY = "millennia-fieldops.locale";

export type TranslateParams = Record<string, string | number>;

export function translate(locale: Locale, text: string, params?: TranslateParams): string {
  const template = DICTIONARIES[locale]?.[text] ?? text;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    params[key] === undefined ? match : String(params[key])
  );
}

// Notification rows are written by a database trigger in English. The patterns
// it produces are translated here; anything else is shown as stored.
export function translateNotification(
  t: (text: string, params?: TranslateParams) => string,
  message: string
): string {
  const reviewed = message.match(
    /^Your (hazard report|record) "(.*)" was (approved|rejected)\.( The job is ready to finish in To do\.)?$/s
  );
  if (reviewed) {
    const [, kind, title, status, jobReady] = reviewed;
    const key =
      kind === "hazard report"
        ? jobReady
          ? 'Your hazard report "{title}" was {status}. The job is ready to finish in To do.'
          : 'Your hazard report "{title}" was {status}.'
        : 'Your record "{title}" was {status}.';
    return t(key, {
      title,
      status: status === "approved" ? t("approved") : t("rejected"),
    });
  }

  // The repair loop. A supervisor assigns work, then either verifies the fix or
  // sends it back with a reason.
  const assigned = message.match(
    /^You were assigned "(.*)"\. Open To do to finish it\.$/s
  );
  if (assigned) {
    return t('You were assigned "{title}". Open To do to finish it.', {
      title: assigned[1],
    });
  }

  const verified = message.match(
    /^Your fix for "(.*)" was verified\. The job is closed\.$/s
  );
  if (verified) {
    return t('Your fix for "{title}" was verified. The job is closed.', {
      title: verified[1],
    });
  }

  const sentBack = message.match(/^Your fix for "(.*)" was sent back: ([\s\S]*)$/);
  if (sentBack) {
    return t('Your fix for "{title}" was sent back: {reason}', {
      title: sentBack[1],
      reason: sentBack[2],
    });
  }

  return message;
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string, params?: TranslateParams) => string;
  ready: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!active) return;
        if (value === "ms" || value === "zh" || value === "en") setLocaleState(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const t = useCallback(
    (text: string, params?: TranslateParams) => translate(locale, text, params),
    [locale]
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
