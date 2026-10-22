// The translation engine, shared by server and client code.
//
// The English sentence is the key: `t("Sign in")` looks the sentence up in the
// chosen language and falls back to English when a translation is missing.
// Placeholders such as {count} are filled from the second argument.
export type Locale = "en" | "ms" | "zh";

export const LOCALES: { value: Locale; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "ms", label: "Bahasa Melayu", short: "BM" },
  { value: "zh", label: "简体中文", short: "中文" },
];

export const LOCALE_COOKIE = "locale";

export type TranslateParams = Record<string, string | number>;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ms" || value === "zh";
}

export function translate(locale: Locale, text: string, params?: TranslateParams): string {
  const template = (locale === "en" ? undefined : DICTIONARIES[locale][text]) ?? text;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    params[key] === undefined ? match : String(params[key])
  );
}

// Imported lazily below so this module stays easy to read: the dictionaries are
// plain objects keyed by the English sentence.
import { ms } from "./ms";
import { zh } from "./zh";

const DICTIONARIES: Record<Exclude<Locale, "en">, Record<string, string>> = { ms, zh };
