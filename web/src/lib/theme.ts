// The colour theme, stored in a cookie like the language.
//
// There is no database preference: the theme belongs to the browser. The choice
// is read on the server so the first paint is already dark (or light) instead of
// flashing white and then swapping.
export const THEME_COOKIE = "theme";

export type ThemePref = "light" | "dark" | "system";

export function isThemePref(value: string | null | undefined): value is ThemePref {
  return value === "light" || value === "dark" || value === "system";
}

// Runs before the first paint. Explicit light/dark is already on the <html>
// element from the server, so this only has work to do for "system": resolve the
// OS setting now, and follow it if the OS flips while the tab stays open.
//
// Kept as a string because it must be inline in <head>; a module would be too
// late and would flash.
export const THEME_INIT_SCRIPT = `(function(){
  var root = document.documentElement;
  if (root.getAttribute("data-theme-pref") !== "system") return;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var apply = function () { root.setAttribute("data-theme", media.matches ? "dark" : "light"); };
  apply();
  if (media.addEventListener) media.addEventListener("change", apply);
  else if (media.addListener) media.addListener(apply);
})();`;
