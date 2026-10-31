// The active palette, and the only way a component gets a colour.
//
// Nothing imports a palette directly: a component calls useTheme() (for icons
// and inline colours) or useThemedStyles() (for its stylesheet). That is what
// lets the whole app change theme with a single state change, without
// remounting a single screen.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { darkColors, lightColors, makeType, type Palette, type ThemeScale } from "../theme";
import { makeTones, type Tones } from "../lib/format";

/**
 * Light or dark. "System" is deliberately absent: the installed build declares
 * `userInterfaceStyle: "light"`, so following the phone's setting needs a new
 * native build, not an update. Once that build ships, "system" becomes a third
 * option here and nothing else changes.
 */
export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "millennia-fieldops.theme";

interface ThemeValue extends ThemeScale {
  /** Type/status/severity/priority tint pairs for the active palette. */
  tones: Tones;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  // The saved choice is read before the first screen mounts, so a dark-mode
  // user does not see a white flash on every cold start.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && stored === "dark") setModeState("dark");
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Hiding after the commit, not before: the first themed frame is already on
  // screen, so the splash gives way to content rather than to a blank view.
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    // Losing the preference is not worth an error: the app still works, it
    // just starts light next time.
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const colors = mode === "dark" ? darkColors : lightColors;
    return {
      colors,
      type: makeType(colors),
      tones: makeTones(colors),
      isDark: mode === "dark",
      mode,
      setMode,
    };
  }, [mode, setMode]);

  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

/**
 * Builds a stylesheet for the active theme, once per theme change.
 *
 *   const makeStyles = ({ colors, type }: ThemeScale) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(makeStyles);
 *
 * `make` must be defined at module scope (as above) so the memo keeps working.
 */
export function useThemedStyles<T>(make: (scale: ThemeScale) => T): T {
  const { colors, type } = useTheme();
  return useMemo(() => make({ colors, type }), [make, colors, type]);
}
