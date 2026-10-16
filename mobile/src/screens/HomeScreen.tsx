import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { countPending } from "../lib/sqlite";
import { syncOutbox } from "../lib/sync";
import { fetchMyRecords } from "../lib/api";
import { useOnlineStatus } from "../lib/network";
import { Banner, Button, Card, Pill, SectionTitle } from "../components/ui";
import { colors } from "../theme";
import {
  ROLE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  formatDate,
  SEVERITY_COLORS,
} from "../lib/format";
import type { FieldRecord } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Home">;

export function HomeScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [recent, setRecent] = useState<FieldRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const queued = await countPending();
    setPending(queued);
    if (profile) {
      try {
        setRecent((await fetchMyRecords(profile.id)).slice(0, 4));
      } catch {
        // offline - keep what we have
      }
    }
  }, [profile]);

  const runSync = useCallback(async () => {
    if (!profile) return;
    setSyncing(true);
    setMessage(null);
    const result = await syncOutbox(profile.id);
    setSyncing(false);
    await refresh();
    if (result.uploaded > 0 && result.failed === 0) {
      setMessage(`Uploaded ${result.uploaded} record(s).`);
    } else if (result.failed > 0) {
      setMessage(`${result.failed} record(s) could not upload yet. They stay in the queue.`);
    } else {
      setMessage("Everything is already uploaded.");
    }
  }, [profile, refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.hello}>Hello{profile ? `, ${profile.full_name.split(" ")[0]}` : ""}</Text>
          <Pill
            label={online ? "Online" : "Offline"}
            color={online ? colors.primary : "#92400E"}
            background={online ? colors.primarySoft : colors.pendingSoft}
            icon={
              <Ionicons
                name={online ? "wifi" : "wifi-outline"}
                size={11}
                color={online ? colors.primary : "#92400E"}
              />
            }
          />
        </View>
        <Text style={styles.sub}>
          {profile ? `${ROLE_LABELS[profile.role]} - Millennia Village` : "Millennia Village"}
        </Text>
        {profile?.email ? <Text style={styles.email}>{profile.email}</Text> : null}
      </View>

      {pending > 0 ? (
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>Pending upload</SectionTitle>
          <Text style={styles.pendingText}>
            {pending} record(s) are saved on this phone and will upload when you have a connection.
          </Text>
          <View style={{ height: 10 }} />
          <Button title={syncing ? "Syncing..." : "Sync now"} onPress={runSync} loading={syncing} />
        </Card>
      ) : null}

      {message ? <Banner kind="info">{message}</Banner> : null}

      <SectionTitle>Capture a new record</SectionTitle>
      <View style={styles.tiles}>
        <Tile
          label="Flora & biodiversity"
          color={TYPE_COLORS.flora.fg}
          bg={TYPE_COLORS.flora.bg}
          onPress={() => navigation.navigate("New", { type: "flora" })}
        />
        <Tile
          label="Soil & water"
          color={TYPE_COLORS.soil_water.fg}
          bg={TYPE_COLORS.soil_water.bg}
          onPress={() => navigation.navigate("New", { type: "soil_water" })}
        />
        <Tile
          label="Environmental hazard"
          color={TYPE_COLORS.hazard.fg}
          bg={TYPE_COLORS.hazard.bg}
          onPress={() => navigation.navigate("New", { type: "hazard" })}
        />
      </View>

      <View style={{ height: 20 }} />
      <SectionTitle>My latest records</SectionTitle>
      {recent.length === 0 ? (
        <Card>
          <Text style={styles.muted}>No records yet. Use the buttons above to capture your first one.</Text>
        </Card>
      ) : (
        recent.map((record) => (
          <Card key={record.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <View style={styles.rowLeft}>
                <Pill
                  label={TYPE_LABELS[record.type]}
                  color={TYPE_COLORS[record.type].fg}
                  background={TYPE_COLORS[record.type].bg}
                />
                {record.type === "hazard" && record.severity ? (
                  <Pill label={record.severity} color="#FFFFFF" background={SEVERITY_COLORS[record.severity]} />
                ) : null}
              </View>
              <Pill
                label={STATUS_LABELS[record.status]}
                color={STATUS_COLORS[record.status].fg}
                background={STATUS_COLORS[record.status].bg}
              />
            </View>
            <Text style={styles.recordTitle}>{record.title}</Text>
            <Text style={styles.recordMeta}>
              {record.zone?.name ?? "No zone"} - {formatDate(record.observed_date)}
            </Text>
            <View style={{ height: 8 }} />
            <Button
              title="View details"
              variant="secondary"
              onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
            />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function Tile({
  label,
  color,
  bg,
  onPress,
}: {
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={styles.tileRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.tileLabel, { color }]}>{label}</Text>
      </View>
      <View style={{ height: 10 }} />
      <Button title="Start capture" onPress={onPress} style={{ backgroundColor: color, borderColor: color }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hello: { fontSize: 22, fontWeight: "800", color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  email: { fontSize: 12, color: colors.muted, marginTop: 2 },
  pendingText: { fontSize: 13, color: colors.ink, lineHeight: 19 },
  tiles: { gap: 4 },
  tileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tileLabel: { fontSize: 15, fontWeight: "700" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLeft: { flexDirection: "row", gap: 6, alignItems: "center" },
  recordTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, marginTop: 8 },
  recordMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  muted: { fontSize: 13, color: colors.muted },
});
