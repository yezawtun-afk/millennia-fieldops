// One record's position, on the same Leaflet page as the site map: its own pin,
// the monitoring zone it belongs to, and the phone's dot, so a worker can see
// where a record was taken without leaving the app for a browser.
//
// The map is a WebView (see RecordMap), so it keeps the site's tiles and pin
// style rather than a second, native-map look.
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fetchZones } from "../lib/api";
import { formatDate, makeTones } from "../lib/format";
import type { FieldRecord, Zone } from "../lib/types";
import { useI18n } from "../i18n";
import { Button, Card, SectionTitle } from "./ui";
import { RecordMap } from "./RecordMap";
import { radius, spacing, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";
import { useUserLocation } from "../lib/useUserLocation";

// Tall enough to read the streets around a pin, short enough to leave the rest
// of the record visible. The page still scrolls; drags over the map pan it.
const MAP_HEIGHT = 230;

export function RecordLocationMap({ record }: { record: FieldRecord }) {
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const tones = useMemo(() => makeTones(colors), [colors]);
  const { userLocation, locationState, startLocation } = useUserLocation();

  const [zones, setZones] = useState<Zone[]>([]);

  // Only for the zone circle. A failure here costs the circle, not the map.
  useEffect(() => {
    let active = true;
    fetchZones()
      .then((rows) => {
        if (active) setZones(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const latitude = record.latitude as number;
  const longitude = record.longitude as number;

  const points = useMemo(
    () => [
      {
        id: record.id,
        lat: latitude,
        lng: longitude,
        color: tones.type[record.type].fg,
        label: record.title,
        sub: `${record.zone?.name ?? t("No zone")} · ${formatDate(record.observed_date)}`,
      },
    ],
    [record.id, record.title, record.type, record.zone?.name, record.observed_date, latitude, longitude, tones, t]
  );

  const zoneShapes = useMemo(
    () =>
      zones
        .filter((zone) => zone.id === record.zone_id)
        .map((zone) => ({
          id: zone.id,
          lat: zone.center_lat,
          lng: zone.center_lng,
          radius: zone.radius_m,
          color: zone.color,
          name: zone.name,
        })),
    [zones, record.zone_id]
  );

  const accuracy =
    userLocation?.accuracy != null ? ` · ±${Math.round(userLocation.accuracy)} m` : "";

  return (
    <Card padded>
      <SectionTitle>{t("Location")}</SectionTitle>

      <View style={styles.frame}>
        <RecordMap
          points={points}
          zones={zoneShapes}
          userLocation={userLocation}
          openRecordLabel=""
          onOpenRecord={() => undefined}
          errorLabel={t("The map could not be loaded. Check your connection and try again.")}
          retryLabel={t("Try again")}
        />
      </View>

      <Text style={styles.coords}>
        {latitude.toFixed(5)}, {longitude.toFixed(5)}
        {accuracy}
      </Text>

      {locationState !== "tracking" ? (
        <Button
          title={t("Show my location")}
          variant="secondary"
          onPress={() => void startLocation(true)}
          loading={locationState === "requesting"}
          style={styles.locate}
        />
      ) : null}
    </Card>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    frame: {
      height: MAP_HEIGHT,
      marginTop: spacing.sm,
      borderRadius: radius.md,
      borderCurve: "continuous",
      overflow: "hidden",
      backgroundColor: colors.line,
    },
    coords: {
      ...type.caption,
      marginTop: spacing.sm,
      fontVariant: ["tabular-nums"],
    },
    locate: { marginTop: spacing.md },
  });
