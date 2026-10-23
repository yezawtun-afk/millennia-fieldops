// The site map, drawn by Leaflet inside a WebView. A native map would need a
// Google Maps key and its own app build; Leaflet uses the same free
// OpenStreetMap tiles as the website, so both show the same picture.
//
// The page itself lives in lib/mapHtml.ts.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { buildMapHtml } from "../lib/mapHtml";
import type { MapPoint, MapZone, UserLocation } from "../lib/mapHtml";
import { Button } from "./ui";
import { colors, spacing } from "../theme";

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
  const webViewRef = useRef<WebView>(null);
  const handledCenterRef = useRef(0);

  // A stable HTML string keeps the WebView from reloading on unrelated
  // re-renders (a sync tick, for example). It changes with the data, the
  // filter or the language, which is exactly when a reload is wanted.
  const html = useMemo(
    () => buildMapHtml(points, zones, { openRecord: openRecordLabel }),
    [points, zones, openRecordLabel]
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
      <WebView
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
      {!ready ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
