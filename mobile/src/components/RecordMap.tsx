// The site map, drawn by Leaflet inside a WebView. A native map would need a
// Google Maps key and its own app build; Leaflet uses the same free
// OpenStreetMap tiles as the website, so both show the same picture.
//
// The page itself lives in lib/mapHtml.ts.
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { buildMapHtml } from "../lib/mapHtml";
import type { MapPoint, MapZone } from "../lib/mapHtml";
import { Button } from "./ui";
import { colors, spacing } from "../theme";

export function RecordMap({
  points,
  zones,
  openRecordLabel,
  onOpenRecord,
  errorLabel,
  retryLabel,
}: {
  points: MapPoint[];
  zones: MapZone[];
  openRecordLabel: string;
  onOpenRecord: (id: string) => void;
  errorLabel: string;
  retryLabel: string;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // A stable HTML string keeps the WebView from reloading on unrelated
  // re-renders (a sync tick, for example). It changes with the data, the
  // filter or the language, which is exactly when a reload is wanted.
  const html = useMemo(
    () => buildMapHtml(points, zones, { openRecord: openRecordLabel }),
    [points, zones, openRecordLabel]
  );

  // If the page never says it started (CDN blocked, for example), stop showing
  // a spinner and offer a retry instead.
  useEffect(() => {
    if (ready || failed) return;
    const timer = setTimeout(() => setFailed(true), 15000);
    return () => clearTimeout(timer);
  }, [ready, failed, attempt]);

  if (failed) {
    return (
      <View style={styles.centered}>
        <Ionicons name="map-outline" size={22} color={colors.muted} />
        <Text style={styles.errorText}>{errorLabel}</Text>
        <Button
          title={retryLabel}
          variant="secondary"
          onPress={() => {
            setFailed(false);
            setReady(false);
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
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              id?: string;
            };
            if (message.type === "open" && message.id) onOpenRecord(message.id);
            if (message.type === "ready") setReady(true);
            if (message.type === "error") setFailed(true);
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
        onError={() => setFailed(true)}
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
