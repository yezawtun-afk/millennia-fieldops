// The phone's own position, shared by every screen that draws it on the map.
//
// One permission prompt, one position watcher, one compass watcher - wherever
// the dot is shown, it behaves the same. The watcher runs only while the screen
// that asked for it is focused, so leaving the map stops the GPS instead of
// draining the battery in the background.
import { useCallback, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import type {
  LocationHeadingObject,
  LocationObject,
  LocationSubscription,
} from "expo-location";
import { bestHeading, smoothHeading } from "./location";
import type { UserLocation } from "./mapHtml";
import { useI18n } from "../i18n";

export type LocationState = "idle" | "requesting" | "tracking" | "denied" | "unavailable";

export interface UserLocationHandle {
  userLocation: UserLocation | null;
  locationState: LocationState;
  /** Start tracking. `requestPermission` shows the system prompt when needed. */
  startLocation: (requestPermission: boolean) => Promise<void>;
  stopLocation: () => void;
}

export function useUserLocation(): UserLocationHandle {
  const { t } = useI18n();

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const focusedRef = useRef(false);
  const startingRef = useRef(false);
  const startTokenRef = useRef(0);
  const positionSubRef = useRef<LocationSubscription | null>(null);
  const headingSubRef = useRef<LocationSubscription | null>(null);
  const lastFixRef = useRef<UserLocation | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const lastEmitRef = useRef(0);

  // A phone can emit compass readings faster than the map needs. Throttle the
  // React updates while keeping the newest fix in a ref.
  const emitLocation = useCallback((next: UserLocation) => {
    const now = Date.now();
    if (now - lastEmitRef.current < 100) return;
    lastEmitRef.current = now;
    setUserLocation(next);
  }, []);

  const handlePosition = useCallback(
    (position: LocationObject) => {
      const next: UserLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
        heading: lastHeadingRef.current,
      };
      lastFixRef.current = next;
      emitLocation(next);
    },
    [emitLocation]
  );

  const handleHeading = useCallback(
    (heading: LocationHeadingObject) => {
      const raw = bestHeading(heading.trueHeading, heading.magHeading);
      const nextHeading =
        raw != null && heading.accuracy > 0 ? smoothHeading(lastHeadingRef.current, raw) : null;
      lastHeadingRef.current = nextHeading;

      const current = lastFixRef.current;
      if (!current) return;
      const next = { ...current, heading: nextHeading };
      lastFixRef.current = next;
      emitLocation(next);
    },
    [emitLocation]
  );

  const handleHeadingError = useCallback(() => {
    lastHeadingRef.current = null;
    const current = lastFixRef.current;
    if (!current) return;
    const next = { ...current, heading: null };
    lastFixRef.current = next;
    emitLocation(next);
  }, [emitLocation]);

  const showLocationSettingsAlert = useCallback(() => {
    Alert.alert(
      t("Location permission is off"),
      t("Enable location access in Settings to show your position on the map."),
      [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Open settings"), onPress: () => void Linking.openSettings() },
      ]
    );
  }, [t]);

  const stopLocation = useCallback(() => {
    focusedRef.current = false;
    startTokenRef.current += 1;
    startingRef.current = false;
    positionSubRef.current?.remove();
    positionSubRef.current = null;
    headingSubRef.current?.remove();
    headingSubRef.current = null;
    lastFixRef.current = null;
    lastHeadingRef.current = null;
    lastEmitRef.current = 0;
    setUserLocation(null);
  }, []);

  const startLocation = useCallback(
    async (requestPermission: boolean) => {
      if (startingRef.current || positionSubRef.current) return;
      startingRef.current = true;
      setLocationState("requesting");
      const token = ++startTokenRef.current;

      try {
        const permission = requestPermission
          ? await Location.requestForegroundPermissionsAsync()
          : await Location.getForegroundPermissionsAsync();
        if (token !== startTokenRef.current || !focusedRef.current) return;

        if (!permission.granted) {
          setLocationState("denied");
          if (!permission.canAskAgain) showLocationSettingsAlert();
          return;
        }

        const servicesOn =
          typeof Location.hasServicesEnabledAsync === "function"
            ? await Location.hasServicesEnabledAsync()
            : true;
        if (token !== startTokenRef.current || !focusedRef.current) return;
        if (!servicesOn) {
          setLocationState("unavailable");
          if (requestPermission) {
            Alert.alert(
              t("Location unavailable"),
              t("Turn on location services to show your position on the map.")
            );
          }
          return;
        }

        const positionSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 2,
            timeInterval: 2000,
          },
          handlePosition
        );
        if (token !== startTokenRef.current || !focusedRef.current) {
          positionSub.remove();
          return;
        }
        positionSubRef.current = positionSub;
        setLocationState("tracking");

        // A missing compass (or a phone without one) must not stop the position
        // dot from working.
        const headingSub =
          typeof Location.watchHeadingAsync === "function"
            ? await Location.watchHeadingAsync(handleHeading, handleHeadingError).catch(() => null)
            : null;
        if (headingSub) {
          if (token !== startTokenRef.current || !focusedRef.current) {
            headingSub.remove();
            return;
          }
          headingSubRef.current = headingSub;
        }
      } catch {
        if (token === startTokenRef.current) {
          setLocationState("unavailable");
          if (requestPermission) {
            Alert.alert(
              t("Location unavailable"),
              t("Turn on location services to show your position on the map.")
            );
          }
        }
      } finally {
        if (token === startTokenRef.current) startingRef.current = false;
      }
    },
    [handleHeading, handleHeadingError, handlePosition, showLocationSettingsAlert, t]
  );

  // If permission was already granted, show the dot as soon as the screen opens.
  // Otherwise stay quiet and let the caller ask for it on a button press.
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      let active = true;

      void (async () => {
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (!active || !focusedRef.current) return;
          if (permission.granted) {
            void startLocation(false);
          } else {
            setLocationState("idle");
          }
        } catch {
          if (active) setLocationState("unavailable");
        }
      })();

      return () => {
        active = false;
        stopLocation();
      };
    }, [startLocation, stopLocation])
  );

  return { userLocation, locationState, startLocation, stopLocation };
}
