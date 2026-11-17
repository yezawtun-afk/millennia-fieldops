import "server-only";
import { cookies } from "next/headers";
import { THEME_COOKIE, isThemePref, type ThemePref } from "./theme";

// Light is the default: the product has always looked like this, and someone
// opening the site for the first time should not be surprised by a dark page.
// Choosing "System" is explicit and remembered.
export async function getTheme(): Promise<ThemePref> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isThemePref(value) ? value : "light";
}
