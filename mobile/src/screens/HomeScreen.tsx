import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { countDrafts, countPending } from "../lib/sqlite";
import { syncOutbox } from "../lib/sync";
import { fetchMyRecords } from "../lib/api";
import { useOnlineStatus } from "../lib/network";
import { appVersion, applyUpdate, checkForUpdate, runningBundle } from "../lib/updates";
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

type CountSummary = { approved: number; pending: number; rejected: number; total: number };

function greetingLine(name: string): string {
  const hour = new Date().getHours();
  const lead = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${lead}, ${name}`;
}

export function HomeScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [drafts, setDrafts] = useState(0);
  const [recent, setRecent] = useState<FieldRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateNote, setUpdateNote] = useState<string | null>(null);

  // Download the waiting bundle and restart into it. On success the app reloads
  // itself, so nothing after that call runs.
  async function applyNow() {
    setCheckingUpdate(true);
    setUpdateNote("Downloading the update...");
    const result = await applyUpdate();
    setCheckingUpdate(false);
    if (!result.ok) setUpdateNote(result.message);
  }

  // `silent` is the version that runs on its own when the app opens: it only
  // speaks up when there really is something to install.
  const runUpdateCheck = useCallback(async (silent: boolean) => {
    const check = await checkForUpdate();

    if (!check.supported) {
      if (!silent) setUpdateNote(check.message);
      return;
    }

    if (!check.available) {
      if (!silent) setUpdateNote("You are on the latest version.");
      return;
    }

    if (silent) {
      Alert.alert(
        "Update available",
        "A newer version of Millennia FieldOps is ready. Restart the app now to use it?",
        [
          { text: "Later", style: "cancel" },
          { text: "Update now", onPress: () => void applyNow() },
        ]
      );
      return;
    }

    await applyNow();
  }, []);

  useEffect(() => {
    void runUpdateCheck(true);
  }, [runUpdateCheck]);

  const summary = recent.reduce<CountSummary>((acc, r) => {
    acc.total += 1;
    if (r.status === "approved") acc.approved += 1;
    else if (r.status === "rejected") acc.rejected += 1;
    else acc.pending += 1;
    return acc;
  }, { approved: 0, pending: 0, rejected: 0, total: 0 });

  const refresh = useCallback(async () => {
    const queued = await countPending();
    setPending(queued);
    setDrafts(await countDrafts());
    if (profile) {
      try {
        setRecent((await fetchMyRecords(profile.id)).slice(0, 6));
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
      {/* Hero header with greeting and network pill */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.greeting}>
              {greetingLine(profile ? profile.full_name.split(" ")[0] : "field worker")}
            </Text>
            <Text style={styles.sub}>{profile ? `${ROLE_LABELS[profile.role]} - Millennia Village` : "Millennia Village"}</Text>
            {profile?.email ? <Text style={styles.email}>{profile.email}</Text> : null}
          </View>
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
        <View style={styles.heroFoot}>
          <Text style={styles.heroFootText}>Declared task: capture field data with GPS and photographs, even offline.</Text>
        </View>
      </View>

      {/* Live status strip */}
      <View style={styles.strip}>
        <StatChip label="Approved" value={summary.approved} color={colors.approved} />
        <StatChip label="Pending" value={pending > 0 ? pending : summary.pending} color={colors.pending} />
        <StatChip label="Drafts" value={drafts} color={colors.hazard} />
        <StatChip label="Rejected" value={summary.rejected} color={colors.rejected} />
      </View>

      {/* Pending upload card (only when something waits) */}
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

      {/* Drafts card */}
      {drafts > 0 ? (
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>Unfinished drafts</SectionTitle>
          <Text style={styles.pendingText}>
            {drafts} record(s) were parked as a draft. Finish them to send them for review.
          </Text>
          <View style={{ height: 10 }} />
          <Button title="Open my records" variant="secondary" onPress={() => navigation.navigate("Records")} />
        </Card>
      ) : null}

      {message ? <Banner kind="info">{message}</Banner> : null}

      {/* Quick capture actions */}
      <SectionTitle>Quick capture</SectionTitle>
      <View style={styles.captureRow}>
        <CaptureChip
          label="Flora"
          icon="leaf-outline"
          fg={TYPE_COLORS.flora.fg}
          bg={TYPE_COLORS.flora.bg}
          onPress={() => navigation.navigate("New", { type: "flora" })}
        />
        <CaptureChip
          label="Soil & water"
          icon="water-outline"
          fg={TYPE_COLORS.soil_water.fg}
          bg={TYPE_COLORS.soil_water.bg}
          onPress={() => navigation.navigate("New", { type: "soil_water" })}
        />
        <CaptureChip
          label="Hazard"
          icon="warning-outline"
          fg={TYPE_COLORS.hazard.fg}
          bg={TYPE_COLORS.hazard.bg}
          onPress={() => navigation.navigate("New", { type: "hazard" })}
        />
      </View>

      <View style={styles.rowBetween}>
        <SectionTitle>My latest records</SectionTitle>
        <Pressable onPress={() => navigation.navigate("Records")} hitSlop={6}>
          <Text style={styles.linkText}>See all</Text>
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <Card>
          <Text style={styles.muted}>
            No records yet. Tap a "Quick capture" chip above, or use the New tab.
          </Text>
        </Card>
      ) : (
        recent.map((record) => (
          <Card key={record.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <View style={styles.rowLeft}>
                <Pill label={TYPE_LABELS[record.type]} color={TYPE_COLORS[record.type].fg} background={TYPE_COLORS[record.type].bg} />
                {record.type === "hazard" && record.severity ? (
                  <Pill label={record.severity} color="#FFFFFF" background={SEVERITY_COLORS[record.severity]} />
                ) : null}
              </View>
              <Pill label={STATUS_LABELS[record.status]} color={STATUS_COLORS[record.status].fg} background={STATUS_COLORS[record.status].bg} />
            </View>
            <Text style={styles.recordTitle}>{record.title}</Text>
            <Text style={styles.recordMeta}>
              {record.zone?.name ?? "No zone"} - {formatDate(record.observed_date)}
            </Text>
            <View style={{ height: 8 }} />
            <View style={styles.cardActions}>
              <Button title="Open details" variant="secondary" onPress={() => navigation.navigate("RecordDetails", { id: record.id })} style={{ flex: 1 }} />
            </View>
          </Card>
        ))
      )}

      <Card style={{ marginTop: 14, marginBottom: 8 }}>
        <SectionTitle>App updates</SectionTitle>
        <Text style={styles.pendingText}>
          Version {appVersion()} ({runningBundle()}). Improvements to the app can arrive without
          reinstalling it - check any time, or accept the prompt when one is waiting.
        </Text>
        {updateNote ? <Text style={styles.updateNote}>{updateNote}</Text> : null}
        <View style={{ height: 10 }} />
        <Button
          title={checkingUpdate ? "Checking..." : "Check for updates"}
          variant="secondary"
          onPress={() => void runUpdateCheck(false)}
          loading={checkingUpdate}
        />
      </Card>

      <Card style={{ marginBottom: 8 }}>
        <SectionTitle>Quick links</SectionTitle>
        <View style={styles.linkGrid}>
          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate("Records")}>
            <Ionicons name="list-outline" size={20} color={colors.primary} />
            <Text style={styles.linkLabel}>My records</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate("Alerts")}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <Text style={styles.linkLabel}>Alerts</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate("New", { type: "hazard" })}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.hazard} />
            <Text style={styles.linkLabel}>Report hazard</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={runSync}>
            <Ionicons name={syncing ? "sync-circle" : "sync-outline"} size={20} color={colors.primary} />
            <Text style={styles.linkLabel}>Sync now</Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statChip}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CaptureChip({ label, icon, fg, bg, onPress }: { label: string; icon: any; fg: string; bg: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.captureChip, { backgroundColor: bg }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={26} color={fg} />
      <Text style={[styles.captureChipLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: colors.forest, padding: 16, borderRadius: 16, marginBottom: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  heroText: { flex: 1 },
  greeting: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  sub: { fontSize: 12.5, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  email: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  heroFoot: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.25)" },
  heroFootText: { fontSize: 12, color: "rgba(255,255,255,0.65)" },
  strip: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statChip: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  statDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  pendingText: { fontSize: 13, color: colors.ink, lineHeight: 19 },
  updateNote: { fontSize: 12, color: colors.primary, marginTop: 6 },
  tiles: { gap: 4 },
  captureRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  captureChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  captureChipLabel: { fontSize: 13, fontWeight: "700" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLeft: { flexDirection: "row", gap: 6, alignItems: "center" },
  recordTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, marginTop: 8 },
  recordMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  muted: { fontSize: 13, color: colors.muted },
  cardActions: { flexDirection: "row", gap: 8 },
  linkText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  linkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  linkBtn: { width: "47%", flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  linkLabel: { fontSize: 13, fontWeight: "600", color: colors.ink },
});
