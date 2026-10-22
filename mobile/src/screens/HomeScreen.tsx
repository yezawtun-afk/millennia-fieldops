import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { countPendingReviews, fetchMyRecords } from "../lib/api";
import { appVersion, applyUpdate, checkForUpdate, runningBundle } from "../lib/updates";
import { useI18n } from "../i18n";
import { Banner, Button, Card, ListRow, Pill, SectionTitle, StatCell } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import { ROLE_LABELS, STATUS_LABELS, TYPE_COLORS, formatDate } from "../lib/format";
import type { FieldRecord, RecordType } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Home">;

type Summary = { approved: number; pending: number; rejected: number };

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const CAPTURE_OPTIONS: {
  type: RecordType;
  label: string;
  meta: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { type: "flora", label: "Flora observation", meta: "Species, health, count", icon: "leaf-outline" },
  { type: "soil_water", label: "Soil & water reading", meta: "pH, moisture, turbidity", icon: "water-outline" },
  { type: "hazard", label: "Hazard report", meta: "Debris, erosion, drainage", icon: "warning-outline" },
];

export function HomeScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const { t } = useI18n();
  const {
    online,
    syncing,
    queued,
    failed,
    drafts,
    lastSyncedAt,
    status: syncStatus,
    remaining,
    syncNow,
    refresh: refreshSync,
  } = useSync();

  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateNote, setUpdateNote] = useState<string | null>(null);

  const isReviewer = profile?.role === "supervisor" || profile?.role === "admin";

  // Download the waiting bundle and restart into it. On success the app reloads
  // itself, so nothing after that call runs.
  async function applyNow() {
    setCheckingUpdate(true);
    setUpdateNote(t("Downloading the update..."));
    const result = await applyUpdate();
    setCheckingUpdate(false);
    if (!result.ok) setUpdateNote(t(result.message));
  }

  // `silent` is the version that runs on its own when the app opens: it only
  // speaks up when there really is something to install.
  const runUpdateCheck = useCallback(
    async (silent: boolean) => {
      const check = await checkForUpdate();

      if (!check.supported) {
        if (!silent) setUpdateNote(t(check.message));
        return;
      }

      if (!check.available) {
        if (!silent) setUpdateNote(t(check.message));
        return;
      }

      if (silent) {
        Alert.alert(
          t("Update available"),
          t("A newer version of Millennia FieldOps is ready. Restart the app now to use it?"),
          [
            { text: t("Later"), style: "cancel" },
            { text: t("Update now"), onPress: () => void applyNow() },
          ]
        );
        return;
      }

      await applyNow();
    },
    [t]
  );

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
    await refreshSync();
    if (!profile) return;
    try {
      setRecords(await fetchMyRecords(profile.id));
    } catch {
      // Offline: keep the records already loaded.
    }
    if (profile.role === "supervisor" || profile.role === "admin") {
      try {
        setReviewCount(await countPendingReviews());
      } catch {
        // keep the last number
      }
    }
  }, [profile, refreshSync]);

  const runSync = useCallback(async () => {
    setMessage(null);
    const result = await syncNow();
    await refresh();
    if (!result) {
      setMessage(t("Could not start the upload. Check your connection."));
      return;
    }
    if (result.uploaded > 0 && result.failed === 0) {
      setMessage(t("Uploaded {count} records.", { count: result.uploaded }));
    } else if (result.failed > 0) {
      setMessage(
        online
          ? t("{count} records could not upload yet. They will retry.", { count: result.failed })
          : t("{count} records wait for a connection.", { count: result.failed })
      );
    } else {
      setMessage(t("Everything is already uploaded."));
    }
  }, [syncNow, refresh, online, t]);

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

  const firstName = profile?.full_name.split(" ")[0] ?? t("field worker");

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{t(greetingKey())}</Text>
          <Text style={styles.name}>{firstName}</Text>
          <Text style={styles.meta}>
            {profile
              ? `${t(ROLE_LABELS[profile.role])} · Millennia Village`
              : "Millennia Village"}
          </Text>
        </View>
      </View>

      <SyncBadge
        status={syncStatus}
        remaining={remaining}
        queued={queued}
        failed={failed}
        online={online}
        lastSyncedAt={lastSyncedAt}
        syncing={syncing}
        onSync={() => void runSync()}
      />

      {isReviewer && reviewCount > 0 ? (
        <View style={styles.reviewNote}>
          <View style={styles.queueTop}>
            <Ionicons name="checkmark-done-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.reviewText}>
              {t("{count} waiting for review", { count: reviewCount })}
            </Text>
          </View>
          <Button
            title={t("Open review queue")}
            variant="secondary"
            onPress={() => navigation.navigate("Review")}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : null}

      <View style={styles.strip}>
        <StatCell label={t("Approved")} value={summary.approved} />
        <StatCell
          label={t("In review")}
          value={summary.pending}
          tone={summary.pending > 0 ? colors.pendingInk : colors.ink}
        />
        <StatCell label={t("Rejected")} value={summary.rejected} />
        <StatCell label={t("Drafts")} value={drafts} last />
      </View>

      {drafts > 0 ? (
        <View style={styles.draftNote}>
          <Text style={styles.draftText}>
            {t("{count} unfinished drafts on this phone.", { count: drafts })}
          </Text>
          <Text style={styles.draftLink} onPress={() => navigation.navigate("Records")}>
            {t("Finish in My records")}
          </Text>
        </View>
      ) : null}

      {message ? <Banner kind="info">{message}</Banner> : null}

      <SectionTitle>{t("Capture")}</SectionTitle>
      <Card>
        {CAPTURE_OPTIONS.map((option, index) => (
          <ListRow
            key={option.type}
            title={t(option.label)}
            meta={t(option.meta)}
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
            {t("See all")}
          </Text>
        }
      >
        {t("Recent records")}
      </SectionTitle>

      {recent.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("Nothing captured yet")}</Text>
            <Text style={styles.emptyHint}>
              {t("Pick a record type above to start. It works offline.")}
            </Text>
          </View>
        </Card>
      ) : (
        <Card>
          {recent.map((record, index) => (
            <ListRow
              key={record.id}
              title={record.title}
              meta={`${record.zone?.name ?? t("No zone")} · ${formatDate(record.observed_date)}`}
              last={index === recent.length - 1}
              onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
              right={
                <Pill
                  label={t(STATUS_LABELS[record.status])}
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

      <SectionTitle>{t("App")}</SectionTitle>
      <Card>
        <ListRow
          title={t("Version")}
          meta={`${appVersion()} · ${runningBundle()}`}
          right={
            <Text style={styles.checkLink} onPress={() => void runUpdateCheck(false)}>
              {checkingUpdate ? t("Checking") : t("Check for update")}
            </Text>
          }
          last
        />
        {updateNote ? (
          <Text style={styles.updateNote}>{updateNote}</Text>
        ) : (
          <Text style={styles.updateHint}>
            {t("Improvements can arrive without reinstalling the app.")}
          </Text>
        )}
      </Card>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

// The visual sync state. Four, not three: a failed upload is not the same as
// "still waiting", and hiding it would leave a field worker guessing.
function SyncBadge({
  status,
  remaining,
  queued,
  failed,
  online,
  syncing,
  lastSyncedAt,
  onSync,
}: {
  status: "synced" | "syncing" | "offline" | "needsRetry";
  remaining: number;
  queued: number;
  failed: number;
  online: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  onSync: () => void;
}) {
  const { t } = useI18n();

  const palette =
    status === "synced"
      ? { bg: colors.approvedSoft, fg: colors.approvedInk, icon: "checkmark-circle" as const }
      : status === "offline"
        ? { bg: colors.rejectedSoft, fg: colors.rejectedInk, icon: "cloud-offline" as const }
        : status === "needsRetry"
          ? { bg: colors.rejectedSoft, fg: colors.rejectedInk, icon: "alert-circle" as const }
          : { bg: colors.pendingSoft, fg: colors.pendingInk, icon: "sync" as const };

  const title =
    status === "synced"
      ? t("Synced")
      : status === "offline"
        ? t("Offline")
        : status === "needsRetry"
          ? t("Needs retry")
          : t("Syncing...");

  const detail =
    status === "synced"
      ? t("All records uploaded")
      : status === "offline"
        ? queued > 0
          ? t("{count} records queued for upload", { count: queued })
          : t("Records are saved on this phone until you reconnect")
        : status === "needsRetry"
          ? t("{count} records need retry", { count: failed })
          : t("{count} records remaining", { count: remaining });

  const when =
    status === "synced"
      ? lastSyncedAt
        ? t("Last upload {when}", { when: relativeTime(t, lastSyncedAt) })
        : t("No uploads yet")
      : null;

  return (
    <View style={[styles.syncCard, { backgroundColor: palette.bg }]}>
      <View style={styles.syncTop}>
        <View style={styles.syncIcon}>
          <Ionicons name={palette.icon} size={18} color={palette.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.syncTitle, { color: palette.fg }]}>{title}</Text>
          <Text style={[styles.syncDetail, { color: palette.fg }]}>{detail}</Text>
          {when ? <Text style={[styles.syncWhen, { color: palette.fg }]}>{when}</Text> : null}
        </View>
      </View>

      {(remaining > 0 || syncing) && online ? (
        <Text style={[styles.syncAction, { color: palette.fg }]} onPress={onSync}>
          {syncing ? t("Syncing...") : t("Sync now")}
        </Text>
      ) : null}
    </View>
  );
}

function relativeTime(t: (text: string, params?: Record<string, string | number>) => string, iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("just now");
  if (minutes < 60) return t("{count}m ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{count}h ago", { count: hours });
  return formatDate(iso);
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

  syncCard: {
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  syncTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  syncIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  syncTitle: { fontSize: 15, fontWeight: "600" },
  syncDetail: { fontSize: 13, marginTop: 1, lineHeight: 18 },
  syncWhen: { fontSize: 12, marginTop: 3, opacity: 0.85 },
  syncAction: { fontSize: 13, fontWeight: "600", marginTop: spacing.sm, textDecorationLine: "underline" },

  reviewNote: {
    marginBottom: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.lg,
  },
  reviewText: { fontSize: 14, fontWeight: "500", color: colors.primaryDark },
  queueTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },

  strip: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
  },

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
