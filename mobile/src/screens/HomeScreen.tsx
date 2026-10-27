import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { countPendingReviews, fetchMyRecords } from "../lib/api";
import { applyUpdate, checkForUpdate } from "../lib/updates";
import { useI18n } from "../i18n";
import { Banner, Button, Card, ListRow, Pill, SectionTitle, StatCell } from "../components/ui";
import { SyncBadge } from "../components/SyncBadge";
import { colors, radius, spacing, type } from "../theme";
import { ROLE_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS, TYPE_COLORS, formatDate } from "../lib/format";
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

  const isReviewer = profile?.role === "supervisor" || profile?.role === "admin";

  // Download the waiting bundle and restart into it. On success the app reloads
  // itself, so nothing after that call runs.
  async function applyNow() {
    const result = await applyUpdate();
    if (!result.ok) Alert.alert(t("Check for update"), t(result.message));
  }

  // Runs by itself when the app opens. Updates can also be checked from the
  // side panel, so this screen only speaks up when there is something to
  // install.
  useEffect(() => {
    let active = true;
    checkForUpdate()
      .then((check) => {
        if (!active || !check.supported || !check.available) return;
        Alert.alert(
          t("Update available"),
          t("A newer version of Millennia FieldOps is ready. Restart the app now to use it?"),
          [
            { text: t("Later"), style: "cancel" },
            { text: t("Update now"), onPress: () => void applyNow() },
          ]
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [t]);

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

  // Jobs a supervisor handed over that are still open. They come first on this
  // screen: someone else is waiting on this worker, which outranks their own
  // paperwork.
  const assignedJobs = profile
    ? records.filter(
        (record) =>
          record.assigned_to === profile.id &&
          record.type === "hazard" &&
          record.status === "approved" &&
          !record.completed_at &&
          !record.closed_at
      )
    : [];

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
            onPress={() => navigation.navigate("ReviewQueue")}
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

      {assignedJobs.length > 0 ? (
        <>
          <SectionTitle>{t("Assigned tasks")}</SectionTitle>
          <Card>
            {assignedJobs.map((record, index) => (
              <ListRow
                key={record.id}
                title={record.title}
                meta={record.zone?.name ?? t("No zone")}
                last={index === assignedJobs.length - 1}
                right={
                  record.priority ? (
                    <Pill
                      label={t(PRIORITY_LABELS[record.priority])}
                      color={PRIORITY_COLORS[record.priority].fg}
                      background={PRIORITY_COLORS[record.priority].bg}
                    />
                  ) : undefined
                }
                icon={
                  <View style={[styles.captureIcon, { backgroundColor: colors.hazardSoft }]}>
                    <Ionicons name="construct-outline" size={18} color={colors.hazard} />
                  </View>
                }
                onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
              />
            ))}
          </Card>
        </>
      ) : null}

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

  empty: { paddingVertical: spacing.lg, alignItems: "center", gap: 2 },
  emptyTitle: { fontSize: 15, fontWeight: "500", color: colors.ink },
  emptyHint: { ...type.caption, textAlign: "center" },
});
