// The site map: every record with a GPS fix, plus the monitoring zones.
// Open to all three roles - the database lets any active account read the
// whole site, and the website's map has always worked the same way.
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { fetchAllRecords, fetchZones } from "../lib/api";
import { useI18n } from "../i18n";
import { Button, Card, ChipGroup } from "../components/ui";
import { RecordMap } from "../components/RecordMap";
import { colors, radius, spacing, type } from "../theme";
import { STATUS_LABELS, TYPE_COLORS, TYPE_LABELS } from "../lib/format";
import type { FieldRecord, RecordType, Zone } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Map">;

// "all" is the only value that is not a record type, so the chips can share
// one string list with the database's type codes.
const FILTERS = ["all", "flora", "soil_water", "hazard"] as const;

export function MapScreen({ navigation }: Props) {
  const { profile, session } = useAuth();
  const { t } = useI18n();
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
          color: TYPE_COLORS[record.type].fg,
          label: record.title,
          sub: `${record.zone?.name ?? t("No zone")} · ${t(STATUS_LABELS[record.status])}`,
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
          style={[styles.pill, mineOnly ? styles.pillOn : null]}
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
          style={styles.iconButton}
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
          <RecordMap
            points={points}
            zones={zoneShapes}
            openRecordLabel={t("Open record")}
            onOpenRecord={(id) => navigation.navigate("RecordDetails", { id })}
            errorLabel={t("The map could not be loaded. Check your connection and try again.")}
            retryLabel={t("Try again")}
          />
        )}
      </Card>

      <View style={styles.legend}>
        <LegendDot color={TYPE_COLORS.flora.fg} label={t("Flora")} />
        <LegendDot color={TYPE_COLORS.soil_water.fg} label={t("Soil & Water")} />
        <LegendDot color={TYPE_COLORS.hazard.fg} label={t("Hazard")} />
        <Text style={styles.legendNote}>{t("Circles show the monitoring zones.")}</Text>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
