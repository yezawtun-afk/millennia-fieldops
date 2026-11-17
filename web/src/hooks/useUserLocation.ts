"use client";

// The browser's own position, for every map on the site.
//
// One permission prompt, one position watcher, and the same rule as the phone:
// never ask on page load. If the browser already remembers the permission as
// granted, the dot appears straight away; otherwise it waits for the locate
// button.
//
// The watcher stops while the tab is hidden and on unmount, so a forgotten tab
// does not keep the GPS awake. When the tab comes back it resumes by itself,
// but only if the dot had been asked for - a visit that never wanted location
// must not prompt later either.
import { useCallback, useEffect, useRef, useState } from "react";

export type LocationState = "idle" | "requesting" | "tracking" | "denied" | "unavailable";

export interface UserFix {
  lat: number;
  lng: number;
  /** Metres, or null when the browser does not report an accuracy figure. */
  accuracy: number | null;
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserFix | null>(null);
  const [state, setState] = useState<LocationState>("idle");

  const watchRef = useRef<number | null>(null);
  // True once the dot has been asked for, so a returning tab can resume.
  const wantedRef = useRef(false);
  const mountedRef = useRef(true);
  const lastEmitRef = useRef(0);

  const stop = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unavailable");
      return;
    }
    wantedRef.current = true;
    if (watchRef.current != null) return;

    setState("requesting");
    lastEmitRef.current = 0;
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!mountedRef.current) return;
        // A phone can report faster than the map needs; keep the newest fix.
        const now = Date.now();
        if (now - lastEmitRef.current < 100) return;
        lastEmitRef.current = now;

        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
        setState("tracking");
      },
      (error) => {
        if (!mountedRef.current) return;
        stop();
        // 1 is PERMISSION_DENIED; unavailable and timeout look the same to the
        // reader, so they share one message.
        setState(error.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
    );
  }, [stop]);

  // Show the dot on load only when the permission is already remembered. Older
  // Safari has no navigator.permissions, so there the button is the only way in.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        if (!navigator.permissions?.query) return;
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (cancelled || status.state !== "granted") return;
        start();
      } catch {
        // The query is optional; the locate button still works without it.
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      stop();
    };
  }, [start, stop]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stop();
        setState((current) => (current === "tracking" ? "idle" : current));
        return;
      }
      if (wantedRef.current) start();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [start, stop]);

  return { location, state, start, stop };
}
