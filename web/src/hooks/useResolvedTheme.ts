"use client";

// The theme as it is actually painted on <html>.
//
// Most components can ignore this: they read CSS variables and flip by
// themselves. Leaflet cannot - it writes literal colours into SVG and needs a
// real basemap URL - so the maps ask this hook instead.
import { useEffect, useState } from "react";

export type ResolvedTheme = "light" | "dark";

function current(): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function useResolvedTheme(): ResolvedTheme {
  // The map is loaded with ssr:false, so reading the DOM for the first value is
  // safe and avoids a frame of light tiles inside a dark page.
  const [theme, setTheme] = useState<ResolvedTheme>(current);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(current());
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
