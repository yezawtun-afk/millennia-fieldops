import { cookies } from "next/headers";
import { isLocale, translate, LOCALE_COOKIE, type Locale, type TranslateParams } from "./translate";

// Server components and server actions read the language from the cookie the
// switcher sets. There is no database preference: the language belongs to the
// browser, like the theme.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export type ServerTranslate = (text: string, params?: TranslateParams) => string;

export async function getT(): Promise<ServerTranslate> {
  const locale = await getLocale();
  return (text: string, params?: TranslateParams) => translate(locale, text, params);
}
