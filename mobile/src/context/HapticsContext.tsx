// The on/off switch for haptic feedback, remembered on the phone.
//
// The preference is pushed into `lib/haptics` the moment it loads, so a screen
// can buzz without knowing this context exists. Only the Profile screen reads
// the value, to draw its switch.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setHapticsEnabled } from "../lib/haptics";

const STORAGE_KEY = "millennia-fieldops.haptics";

type HapticsValue = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
};

const HapticsContext = createContext<HapticsValue | null>(null);

export function HapticsProvider({ children }: { children: React.ReactNode }) {
  // On by default: the feature is meant to be felt, not discovered.
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || stored !== "off") return;
        setEnabledState(false);
        setHapticsEnabled(false);
      })
      .catch(() => {
        // Unreadable storage just means the default stays on.
      });
    return () => {
      active = false;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    setHapticsEnabled(next);
    void AsyncStorage.setItem(STORAGE_KEY, next ? "on" : "off").catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>;
}

export function useHaptics(): HapticsValue {
  const value = useContext(HapticsContext);
  if (!value) throw new Error("useHaptics must be used inside HapticsProvider");
  return value;
}
