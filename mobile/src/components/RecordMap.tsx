// The site map, drawn by Leaflet inside a WebView. A native map would need a
// Google Maps key and its own app build; Leaflet uses the same free
// OpenStreetMap tiles as the website, so both show the same picture.
//
// The page itself lives in lib/mapHtml.ts.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { buildMapHtml } from "../lib/mapHtml";
import type { MapPoint, MapZone, UserLocation } from "../lib/mapHtml";
import { useI18n } from "../i18n";
import { Button } from "./ui";
import { radius, shadow, spacing, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";

// A base map is a preference, not a per-visit choice: a worker who reads
// terrain better on imagery should not have to switch again after a restart.
const BASEMAP_KEY = "millennia-fieldops.basemap";
type BaseLayer = "street" | "satellite";

export function RecordMap({
  points,
  zones,
  userLocation = null,
  centerRequest = 0,
  openRecordLabel,
  onOpenRecord,
  errorLabel,
  retryLabel,
}: {
  points: MapPoint[];
  zones: MapZone[];
  userLocation?: UserLocation | null;
  centerRequest?: number;
  openRecordLabel: string;
  onOpenRecord: (id: string) => void;
  errorLabel: string;
  retryLabel: string;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("street");
  const webViewRef = useRef<WebView<object> | null>(null);
  const handledCenterRef = useRef(0);
  const styles = useThemedStyles(makeStyles);
  const { colors, isDark } = useTheme();
  const { t } = useI18n();

  // A stable HTML string keeps the WebView from reloading on unrelated
  // re-renders (a sync tick, for example). It changes with the data, the
  // filter or the language, which is exactly when a reload is wanted.
  const html = useMemo(
    () => buildMapHtml(points, zones, { openRecord: openRecordLabel }, colors, isDark),
    [points, zones, openRecordLabel, colors, isDark]
  );

  // If the page never says it started, stop showing a spinner and offer a
  // retry instead.
  useEffect(() => {
    if (ready || failed) return;
    const timer = setTimeout(() => {
      setDetail("The map page did not finish loading.");
      setFailed(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, [ready, failed, attempt]);

  // Location updates are injected instead of rebuilt into the HTML, so the
  // WebView does not reload every time the phone moves.
  useEffect(() => {
    if (!ready) return;
    const view = webViewRef.current;
    if (!view) return;

    if (!userLocation) {
      view.injectJavaScript("window.clearUserLocation && window.clearUserLocation(); true;");
      return;
    }

    const heading = userLocation.heading == null ? "null" : userLocation.heading.toFixed(1);
    const accuracy =
      userLocation.accuracy == null ? "null" : String(Math.round(userLocation.accuracy));
    view.injectJavaScript(
      `window.setUserLocation && window.setUserLocation(${userLocation.lat.toFixed(7)}, ${userLocation.lng.toFixed(7)}, ${heading}, ${accuracy}); true;`
    );
  }, [ready, userLocation]);

  useEffect(() => {
    if (!ready || !userLocation || centerRequest === 0) return;
    if (handledCenterRef.current === centerRequest) return;
    handledCenterRef.current = centerRequest;
    webViewRef.current?.injectJavaScript("window.centerOnUser && window.centerOnUser(); true;");
  }, [ready, userLocation, centerRequest]);

  // Restore the saved basemap once, then follow the choice from then on.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(BASEMAP_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved === "street" || saved === "satellite") setBaseLayer(saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Injected rather than rebuilt into the HTML: a rebuild would reload the page
  // and lose the zoom and the pan.
  useEffect(() => {
    if (!ready) return;
    webViewRef.current?.injectJavaScript(
      `window.setBaseLayer && window.setBaseLayer("${baseLayer}"); true;`
    );
  }, [ready, baseLayer]);

  function chooseBaseLayer(next: BaseLayer) {
    if (next === baseLayer) return;
    setBaseLayer(next);
    void AsyncStorage.setItem(BASEMAP_KEY, next).catch(() => undefined);
  }

  if (failed) {
    return (
      <View style={styles.centered}>
        <Ionicons name="map-outline" size={22} color={colors.muted} />
        <Text style={styles.errorText}>{errorLabel}</Text>
        {detail ? <Text style={styles.detailText}>{detail}</Text> : null}
        <Button
          title={retryLabel}
          variant="secondary"
          onPress={() => {
            setFailed(false);
            setReady(false);
            setDetail(null);
            setAttempt((current) => current + 1);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <WebView<object>
        key={attempt}
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onLoadStart={() => setReady(false)}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              id?: string;
              message?: string;
            };
            if (message.type === "open" && message.id) onOpenRecord(message.id);
            if (message.type === "ready") setReady(true);
            if (message.type === "error") {
              setDetail(message.message ?? null);
              setFailed(true);
            }
          } catch {
            // A message we did not write; ignore it.
          }
        }}
        // Attribution links belong in the phone's browser, not inside the map.
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith("http")) {
            void Linking.openURL(request.url);
            return false;
          }
          return true;
        }}
        onError={(event) => {
          setDetail(event.nativeEvent.description || "The map view failed to load.");
          setFailed(true);
        }}
      />
      {/* Top-left, clear of the app's "My location" pill on the right and of
          Leaflet's zoom buttons at the bottom. Hidden until the page is ready
          so a tap cannot arrive before window.setBaseLayer exists. */}
      {ready ? (
        <View style={styles.layerToggle}>
          <Pressable
            onPress={() => chooseBaseLayer("street")}
            accessibilityRole="button"
            accessibilityLabel={t("Street")}
            accessibilityState={{ selected: baseLayer === "street" }}
            style={[
              styles.layerButton,
              baseLayer === "street" ? styles.layerButtonActive : null,
            ]}
          >
            <Ionicons
              name="map-outline"
              size={14}
              color={baseLayer === "street" ? colors.primaryDark : colors.muted}
            />
            <Text
              style={[
                styles.layerLabel,
                { color: baseLayer === "street" ? colors.primaryDark : colors.muted },
              ]}
            >
              {t("Street")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => chooseBaseLayer("satellite")}
            accessibilityRole="button"
            accessibilityLabel={t("Satellite")}
            accessibilityState={{ selected: baseLayer === "satellite" }}
            style={[
              styles.layerButton,
              styles.layerButtonEnd,
              baseLayer === "satellite" ? styles.layerButtonActive : null,
            ]}
          >
            <Ionicons
              name="globe-outline"
              size={14}
              color={baseLayer === "satellite" ? colors.primaryDark : colors.muted}
            />
            <Text
              style={[
                styles.layerLabel,
                { color: baseLayer === "satellite" ? colors.primaryDark : colors.muted },
              ]}
            >
              {t("Satellite")}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {!ready ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors }: ThemeScale) =>
  StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.page },
    web: { flex: 1, backgroundColor: colors.page },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      backgroundColor: colors.page,
      padding: spacing.xl,
    },
    errorText: {
      fontSize: 14,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    detailText: {
      fontSize: 12,
      color: colors.faint,
      textAlign: "center",
      lineHeight: 17,
    },
    overlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.page,
    },
    layerToggle: {
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      zIndex: 10,
      flexDirection: "row",
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.control,
      backgroundColor: colors.card,
      overflow: "hidden",
      boxShadow: shadow.control,
    },
    layerButton: {
      height: 34,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
    },
    layerLabel: { fontSize: 11, fontWeight: "600" },
    layerButtonEnd: { borderLeftWidth: 1, borderLeftColor: colors.line },
    layerButtonActive: { backgroundColor: colors.primarySoft },
});
