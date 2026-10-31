// The site map: every record with a GPS fix, plus the monitoring zones.
// Open to all three roles - the database lets any active account read the
// whole site, and the website's map has always worked the same way.
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import type {
  LocationHeadingObject,
  LocationObject,
  LocationSubscription,
} from "expo-location";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { fetchAllRecords, fetchZones } from "../lib/api";
import { bestHeading, smoothHeading } from "../lib/location";
import type { UserLocation } from "../lib/mapHtml";
import { useI18n } from "../i18n";
import { Button, Card, ChipGroup } from "../components/ui";
import { RecordMap } from "../components/RecordMap";
import { radius, shadow, spacing, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";
import { STATUS_LABELS, TYPE_LABELS } from "../lib/format";
import type { FieldRecord, RecordType, Zone } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Map">;

type LocationState = "idle" | "requesting" | "tracking" | "denied" | "unavailable";

// "all" is the only value that is not a record type, so the chips can share
// one string list with the database's type codes.
const FILTERS = ["all", "flora", "soil_water", "hazard"] as const;

export function MapScreen({ navigation }: Props) {
  const { profile, session } = useAuth();
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);
  const { colors, tones } = useTheme();
  const { online } = useSync();
  const userId = session?.user.id ?? profile?.id ?? null;

  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextRecords, nextZones] = await Promise.all([fetchAllRecords(), fetchZones()]);
      setRecords(nextRecords);
      setZones(nextZones);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh whenever the tab comes into view, so a new record shows up without
  // a manual pull.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [centerRequest, setCenterRequest] = useState(0);
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

        // A missing compass (or a browser without one) must not stop the
        // position dot from working.
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

  // If permission was already granted, show the dot as soon as the map opens.
  // Otherwise stay quiet and let the "My location" button ask for it.
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

  function handleLocatePress() {
    if (locationState === "requesting") return;
    setCenterRequest((current) => current + 1);
    if (locationState !== "tracking") void startLocation(true);
  }

  const points = useMemo(
    () =>
      records
        .filter((record) => record.latitude != null && record.longitude != null)
        .filter((record) => filter === "all" || record.type === filter)
        .filter((record) => !mineOnly || record.submitted_by === userId)
        .map((record) => ({
          id: record.id,
          lat: record.latitude as number,
          lng: record.longitude as number,
          color: tones.type[record.type].fg,
          label: record.title,
          sub: `${record.zone?.name ?? t("No zone")} Â· ${t(STATUS_LABELS[record.status])}`,
        })),
    [records, filter, mineOnly, userId, t]
  );

  const zoneShapes = useMemo(
    () =>
      zones.map((zone) => ({
        id: zone.id,
        lat: zone.center_lat,
        lng: zone.center_lng,
        radius: zone.radius_m,
        color: zone.color,
        name: zone.name,
      })),
    [zones]
  );

  const chipLabel = (value: string) =>
    value === "all" ? t("All") : t(TYPE_LABELS[value as RecordType]);

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>{t("Site map")}</Text>
          <Text style={styles.sub}>
            {t("{count} records plotted across {zones} monitoring zones.", {
              count: points.length,
              zones: zones.length,
            })}
          </Text>
        </View>

        <Pressable
          onPress={() => setMineOnly((current) => !current)}
          accessibilityRole="button"
          accessibilityState={{ selected: mineOnly }}
          accessibilityLabel={t("Mine")}
          style={({ pressed }) => [
            styles.pill,
            mineOnly ? styles.pillOn : null,
            pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Ionicons
            name="person-outline"
            size={13}
            color={mineOnly ? colors.primaryDark : colors.muted}
          />
          <Text style={[styles.pillText, mineOnly ? styles.pillTextOn : null]}>{t("Mine")}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setLoading(true);
            void load();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("Refresh")}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && { opacity: 0.55, transform: [{ scale: 0.92 }] },
          ]}
        >
          <Ionicons name="refresh" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <ChipGroup
        options={[...FILTERS]}
        value={filter}
        onChange={setFilter}
        labelFor={chipLabel}
      />

      <Card style={styles.mapCard}>
        {!online ? (
          <View style={styles.placeholder}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.muted} />
            <Text style={styles.placeholderText}>{t("Map needs a connection.")}</Text>
          </View>
        ) : loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.placeholderText}>{t("Loading map...")}</Text>
          </View>
        ) : error ? (
          <View style={styles.placeholder}>
            <Ionicons name="map-outline" size={22} color={colors.muted} />
            <Text style={styles.placeholderText}>
              {t("Could not load the map. Check your connection and try again.")}
            </Text>
            <Button
              title={t("Try again")}
              variant="secondary"
              onPress={() => {
                setLoading(true);
                void load();
              }}
            />
          </View>
        ) : (
          <>
            <RecordMap
              points={points}
              zones={zoneShapes}
              userLocation={userLocation}
              centerRequest={centerRequest}
              openRecordLabel={t("Open record")}
              onOpenRecord={(id) => navigation.navigate("RecordDetails", { id })}
              errorLabel={t("The map could not be loaded. Check your connection and try again.")}
              retryLabel={t("Try again")}
            />
            <Pressable
              onPress={handleLocatePress}
              disabled={locationState === "requesting"}
              accessibilityRole="button"
              accessibilityLabel={t("My location")}
              accessibilityState={{ busy: locationState === "requesting" }}
              style={({ pressed }) => [
                styles.locateButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
              ]}
            >
              {locationState === "requesting" ? (
                <ActivityIndicator size="small" color={colors.locationInk} />
              ) : (
                <Ionicons
                  name={locationState === "tracking" ? "locate" : "locate-outline"}
                  size={15}
                  color={locationState === "tracking" ? colors.locationInk : colors.ink}
                />
              )}
              <Text style={styles.locateText}>{t("My location")}</Text>
            </Pressable>
          </>
        )}
      </Card>

      <View style={styles.legend}>
        <LegendDot color={tones.type.flora.fg} label={t("Flora")} />
        <LegendDot color={tones.type.soil_water.fg} label={t("Soil & Water")} />
        <LegendDot color={tones.type.hazard.fg} label={t("Hazard")} />
        <Text style={styles.legendNote}>{t("Circles show the monitoring zones.")}</Text>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.page, padding: spacing.lg, gap: spacing.md },
    head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    headText: { flex: 1, minWidth: 0 },
    title: { ...type.title, fontSize: 22 },
    sub: { ...type.caption, marginTop: 2 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: colors.control,
      backgroundColor: colors.card,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      height: 30,
    },
    pillOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    pillText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
    pillTextOn: { color: colors.primaryDark, fontWeight: "600" },
    iconButton: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.full,
    },
    mapCard: { flex: 1, overflow: "hidden" },
    locateButton: {
      position: "absolute",
      top: spacing.md,
      right: spacing.md,
      zIndex: 10,
      height: 34,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.control,
      backgroundColor: colors.card,
      boxShadow: shadow.control,
    },
    locateText: { fontSize: 12, fontWeight: "600", color: colors.ink },
    placeholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      padding: spacing.xl,
    },
    placeholderText: {
      fontSize: 14,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.md,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    dot: { width: 9, height: 9, borderRadius: radius.full },
    legendLabel: { fontSize: 12, color: colors.ink, fontWeight: "500" },
    legendNote: { fontSize: 12, color: colors.muted },
});
