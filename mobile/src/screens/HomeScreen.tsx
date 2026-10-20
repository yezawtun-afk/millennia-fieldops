import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { countDrafts, countPending } from "../lib/sqlite";
import { syncOutbox } from "../lib/sync";
import { fetchMyRecords } from "../lib/api";
import { useOnlineStatus } from "../lib/network";
import { appVersion, applyUpdate, checkForUpdate, runningBundle } from "../lib/updates";
import { Banner, Button, Card, ListRow, Pill, SectionTitle, StatCell } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  TYPE_COLORS,
  formatDate,
} from "../lib/format";
import type { FieldRecord, RecordType } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Home">;

type Summary = { approved: number; pending: number; rejected: number };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const CAPTURE_OPTIONS: { type: RecordType; label: string; meta: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "flora", label: "Flora observation", meta: "Species, health, count", icon: "leaf-outline" },
  { type: "soil_water", label: "Soil & water reading", meta: "pH, moisture, turbidity", icon: "water-outline" },
  { type: "hazard", label: "Hazard report", meta: "Debris, erosion, drainage", icon: "warning-outline" },
];

export function HomeScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [queued, setQueued] = useState(0);
  const [drafts, setDrafts] = useState(0);
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

  // Counts come from every record this user has, not from the five shown below.
  const summary = records.reduce<Summary>(
    (acc, record) => {
      if (record.status === "approved") acc.approved += 1;
      else if (record.status === "rejected") acc.rejected += 1;
      else acc.pending += 1;
      return acc;
    },
    { approved: 0, pending: 0, rejected: 0 }
  );

  const recent = records.slice(0, 5);

  const refresh = useCallback(async () => {
    setQueued(await countPending());
    setDrafts(await countDrafts());
    if (!profile) return;
    try {
      setRecords(await fetchMyRecords(profile.id));
    } catch {
      // Offline: keep the records already loaded.
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
      setMessage(`Uploaded ${result.uploaded} record${result.uploaded === 1 ? "" : "s"}.`);
    } else if (result.failed > 0) {
      setMessage(
        `${result.failed} record${result.failed === 1 ? "" : "s"} could not upload yet. ${
          online ? "They will retry." : "They wait for a connection."
        }`
      );
    } else {
      setMessage("Everything is already uploaded.");
    }
  }, [profile, refresh, online]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const firstName = profile?.full_name.split(" ")[0] ?? "field worker";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.name}>{firstName}</Text>
          <Text style={styles.meta}>
            {profile ? `${ROLE_LABELS[profile.role]} · Millennia Village` : "Millennia Village"}
          </Text>
        </View>
        <Pill
          label={online ? "Online" : "Offline"}
          color={online ? colors.primaryDark : colors.pendingInk}
          background={online ? colors.primarySoft : colors.pendingSoft}
          icon={
            <Ionicons
              name={online ? "wifi" : "cloud-offline-outline"}
              size={11}
              color={online ? colors.primaryDark : colors.pendingInk}
            />
          }
        />
      </View>

      <View style={styles.strip}>
        <StatCell label="Approved" value={summary.approved} />
        <StatCell label="In review" value={summary.pending} tone={summary.pending > 0 ? colors.pendingInk : colors.ink} />
        <StatCell label="Rejected" value={summary.rejected} />
        <StatCell label="Drafts" value={drafts} last />
      </View>

      {queued > 0 ? (
        <View style={styles.queue}>
          <View style={styles.queueTop}>
            <Ionicons name="cloud-upload-outline" size={18} color={colors.pendingInk} />
            <Text style={styles.queueText}>
              {queued} record{queued === 1 ? "" : "s"} waiting to upload
            </Text>
          </View>
          <Button
            title={syncing ? "Syncing" : "Sync now"}
            variant="secondary"
            onPress={runSync}
            loading={syncing}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : null}

      {drafts > 0 ? (
        <View style={styles.draftNote}>
          <Text style={styles.draftText}>
            {drafts} unfinished draft{drafts === 1 ? "" : "s"} on this phone.
          </Text>
          <Text style={styles.draftLink} onPress={() => navigation.navigate("Records")}>
            Finish in My records
          </Text>
        </View>
      ) : null}

      {message ? <Banner kind="info">{message}</Banner> : null}

      <SectionTitle>Capture</SectionTitle>
      <Card>
        {CAPTURE_OPTIONS.map((option, index) => (
          <ListRow
            key={option.type}
            title={option.label}
            meta={option.meta}
            last={index === CAPTURE_OPTIONS.length - 1}
            icon={
              <View
                style={[
                  styles.captureIcon,
                  { backgroundColor: TYPE_COLORS[option.type].bg },
                ]}
              >
                <Ionicons name={option.icon} size={18} color={TYPE_COLORS[option.type].fg} />
              </View>
            }
            onPress={() => navigation.navigate("New", { type: option.type })}
          />
        ))}
      </Card>

      <View style={{ height: spacing.xl }} />

      <SectionTitle
        action={
          <Text style={styles.link} onPress={() => navigation.navigate("Records")}>
            See all
          </Text>
        }
      >
        Recent records
      </SectionTitle>

      {recent.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing captured yet</Text>
            <Text style={styles.emptyHint}>Pick a record type above to start. It works offline.</Text>
          </View>
        </Card>
      ) : (
        <Card>
          {recent.map((record, index) => (
            <ListRow
              key={record.id}
              title={record.title}
              meta={`${record.zone?.name ?? "No zone"} · ${formatDate(record.observed_date)}`}
              last={index === recent.length - 1}
              onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
              right={
                <Pill
                  label={STATUS_LABELS[record.status]}
                  color={
                    record.status === "pending"
                      ? colors.pendingInk
                      : record.status === "approved"
                        ? colors.approvedInk
                        : colors.rejectedInk
                  }
                  background={
                    record.status === "pending"
                      ? colors.pendingSoft
                      : record.status === "approved"
                        ? colors.approvedSoft
                        : colors.rejectedSoft
                  }
                />
              }
            />
          ))}
        </Card>
      )}

      <View style={{ height: spacing.xl }} />

      <SectionTitle>App</SectionTitle>
      <Card>
        <ListRow
          title="Version"
          meta={`${appVersion()} · ${runningBundle()}`}
          right={
            <Text style={styles.checkLink} onPress={() => void runUpdateCheck(false)}>
              {checkingUpdate ? "Checking" : "Check for update"}
            </Text>
          }
          last
        />
        {updateNote ? (
          <Text style={styles.updateNote}>{updateNote}</Text>
        ) : (
          <Text style={styles.updateHint}>
            Improvements can arrive without reinstalling the app.
          </Text>
        )}
      </Card>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  greeting: { ...type.caption, fontSize: 13 },
  name: { ...type.title, marginTop: 1 },
  meta: { ...type.subhead, marginTop: 2 },

  strip: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
  },

  queue: {
    marginTop: spacing.md,
    backgroundColor: colors.pendingSoft,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.lg,
  },
  queueTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  queueText: { fontSize: 14, fontWeight: "500", color: colors.pendingInk },

  draftNote: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: 2,
  },
  draftText: { ...type.body, fontSize: 14 },
  draftLink: { fontSize: 13, fontWeight: "500", color: colors.primary },

  captureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  link: { fontSize: 13, fontWeight: "500", color: colors.primary },
  checkLink: { fontSize: 13, fontWeight: "500", color: colors.primary },

  empty: { paddingVertical: spacing.lg, alignItems: "center", gap: 2 },
  emptyTitle: { fontSize: 15, fontWeight: "500", color: colors.ink },
  emptyHint: { ...type.caption, textAlign: "center" },

  updateNote: {
    ...type.caption,
    color: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  updateHint: {
    ...type.caption,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: 2,
  },
});
