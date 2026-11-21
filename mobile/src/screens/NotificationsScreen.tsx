import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { fetchNotifications, fetchRecord } from "../lib/api";
import {
  ensureNotificationPermission,
  markAllRead,
  notificationPermission,
  presentUnreadNotifications,
} from "../lib/notifications";
import { useI18n, translateNotification } from "../i18n";
import { Button, Card, SectionTitle } from "../components/ui";
import { radius, spacing, type Palette, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";
import { formatDateTime } from "../lib/format";
import type { AppNotification } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Alerts">;
type T = (text: string, params?: Record<string, string | number>) => string;

function relativeTime(t: T, iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return formatDateTime(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("Just now");
  if (m < 60) return t("{count}m ago", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("{count}h ago", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("{count}d ago", { count: d });
  return formatDateTime(iso);
}

function dayBucket(t: T, iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return t("Today");
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return t("Yesterday");
  return formatDateTime(iso);
}

// What the small icon and tint mean. A rejection is the only one that has work
// behind it, so it is also the only one the screen promotes to "needs
// attention".
function accentForMessage(
  colors: Palette,
  msg: string
): {
  bg: string;
  fg: string;
  icon: "checkmark-circle" | "close-circle" | "notifications";
} {
  const lower = msg.toLowerCase();
  if (lower.includes("approved") || lower.includes("verified")) {
    return { bg: colors.approvedSoft, fg: colors.approved, icon: "checkmark-circle" };
  }
  if (lower.includes("rejected") || lower.includes("sent back")) {
    return { bg: colors.rejectedSoft, fg: colors.rejected, icon: "close-circle" };
  }
  return { bg: colors.primarySoft, fg: colors.primary, icon: "notifications" };
}

export function NotificationsScreen({ navigation }: Props) {
  const { profile, session } = useAuth();
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const userId = session?.user.id ?? profile?.id ?? null;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // null = "this build cannot ask" (Expo Go on Android), so the prompt is hidden
  // rather than offered and then failing.
  const [alertsAllowed, setAlertsAllowed] = useState<boolean | null>(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setItems(await fetchNotifications(userId));
    } catch {
      // offline
    }
  }, [userId]);

  // New reviews are announced by the watcher in RootNavigator while the app is
  // open, so opening this tab only has to list them.
  useFocusEffect(
    useCallback(() => {
      load();
      notificationPermission().then(setAlertsAllowed);
    }, [load])
  );

  // A rejection is the only thing here that leaves the worker with something to
  // do, so it sits apart from the news. Reading it is what retires it: "Mark all
  // read", or resubmitting it.
  const needsAttention = useMemo(
    () => items.filter((item) => item.record_status === "rejected" && !item.read_at),
    [items]
  );
  const flagged = useMemo(() => new Set(needsAttention.map((item) => item.id)), [needsAttention]);

  const recent = useMemo(() => items.filter((item) => !flagged.has(item.id)), [items, flagged]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const item of recent) {
      const key = dayBucket(t, item.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [recent, t]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function markRead() {
    if (!userId) return;
    setBusy(true);
    await markAllRead(userId);
    await load();
    setBusy(false);
  }

  async function markOneRead(item: AppNotification) {
    try {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", item.id);
    } catch {
      // ignore - server triggers will mirror eventually
    }
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
    );
  }

  async function enableAlerts() {
    const granted = await ensureNotificationPermission();
    setAlertsAllowed(granted);
    if (!granted) {
      Alert.alert(
        t("Phone alerts are off"),
        t("Allow notifications for Millennia FieldOps in your phone settings, then come back.")
      );
      return;
    }
    if (userId) await presentUnreadNotifications(userId);
  }

  function openRecord(item: AppNotification) {
    if (!item.record_id) return;
    navigation.navigate("RecordDetails", { id: item.record_id });
  }

  // A rejected record cannot be edited in place, so this starts a fresh report
  // from the old answers. The photos are deliberately left behind: a retake is
  // usually the whole point of a rejection.
  async function resubmit(item: AppNotification) {
    if (!item.record_id) return;
    setOpeningId(item.id);
    const record = await fetchRecord(item.record_id);
    setOpeningId(null);
    if (!record) {
      Alert.alert(
        t("Could not open the record"),
        t("Check your connection and try again.")
      );
      return;
    }
    if (!item.read_at) await markOneRead(item);
    navigation.navigate("New", {
      prefill: {
        type: record.type,
        title: record.title,
        notes: record.notes,
        zoneId: record.zone_id,
        latitude: record.latitude,
        longitude: record.longitude,
        speciesName: record.species_name,
        growthStage: record.growth_stage,
        healthCondition: record.health_condition,
        estimatedCount: record.estimated_count,
        hazardType: record.hazard_type,
        severity: record.severity,
        readingType: record.reading_type,
        readingValue: record.reading_value,
        readingUnit: record.reading_unit,
        feedback: record.supervisor_feedback,
      },
    });
  }

  const unread = items.filter((i) => !i.read_at).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.card}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{t("Notifications")}</Text>
          <Text style={styles.subline}>
            {t("{unread} unread · {total} total", { unread, total: items.length })}
          </Text>
        </View>
        {unread > 0 ? (
          <Pressable
            onPress={markRead}
            disabled={busy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            style={({ pressed }) => [styles.markAll, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.markAllText}>{busy ? t("Marking...") : t("Mark all read")}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Only while the phone cannot buzz. Once allowed, it is a line of the
          screen with nothing left to do. */}
      {alertsAllowed === false ? (
        <View style={styles.enableBanner}>
          <Ionicons name="notifications-outline" size={18} color={colors.primaryDark} />
          <View style={styles.enableBody}>
            <Text style={styles.enableTitle}>{t("Enable phone alerts")}</Text>
            <Text style={styles.enableText}>
              {t("Get a buzz on this phone when a record is reviewed.")}
            </Text>
          </View>
          <Pressable
            onPress={enableAlerts}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.enableBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.enableBtnText}>{t("Enable")}</Text>
          </Pressable>
        </View>
      ) : null}

      {items.length === 0 ? (
        <Card padded>
          <Ionicons name="notifications-off-outline" size={26} color={colors.muted} />
          <Text style={styles.emptyTitle}>{t("No notifications yet")}</Text>
          <Text style={styles.muted}>
            {t("You will be alerted here when a supervisor approves or rejects one of your records.")}
          </Text>
        </Card>
      ) : null}

      {needsAttention.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="alert-circle" size={14} color={colors.rejected} />
            <Text style={styles.sectionLabel}>{t("Needs attention")}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{needsAttention.length}</Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            {needsAttention.map((item) => {
              const comment = item.supervisor_feedback?.trim();
              const opening = openingId === item.id;
              return (
                <Card key={item.id} padded style={styles.attentionCard}>
                  <View style={styles.attentionHead}>
                    <View style={styles.attentionTitleWrap}>
                      <Text style={styles.attentionTitle} numberOfLines={2}>
                        {item.record_title ?? t("Rejected record")}
                      </Text>
                      <Text style={styles.attentionMeta}>
                        {t("Sent back")} · {relativeTime(t, item.created_at)}
                      </Text>
                    </View>
                  </View>

                  {comment ? (
                    <View style={styles.quote}>
                      <Text style={styles.quoteText}>{comment}</Text>
                    </View>
                  ) : null}

                  <View style={styles.rowActions}>
                    <Button
                      title={opening ? t("Opening...") : t("Resubmit")}
                      onPress={() => resubmit(item)}
                      loading={opening}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title={t("Open record")}
                      variant="secondary"
                      onPress={() => openRecord(item)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      ) : null}

      {recent.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={styles.sectionLabel}>{t("Recent activity")}</Text>
          </View>

          {Array.from(grouped.entries()).map(([title, rows]) => (
            <View key={title} style={{ marginBottom: spacing.md }}>
              <SectionTitle>{title}</SectionTitle>
              <Card>
                {rows.map((item, index) => {
                  const { bg, fg, icon } = accentForMessage(colors, item.message);
                  const last = index === rows.length - 1;
                  const row = (
                    <>
                      <View style={[styles.rowIcon, { backgroundColor: bg }]}>
                        <Ionicons name={icon} size={15} color={fg} />
                      </View>
                      <View style={styles.rowBody}>
                        <View style={styles.rowTitleLine}>
                          <Text
                            style={[styles.rowTitle, !item.read_at ? styles.rowTitleUnread : null]}
                            numberOfLines={1}
                          >
                            {item.record_title ?? t("Update")}
                          </Text>
                          {!item.read_at ? <View style={styles.dot} /> : null}
                        </View>
                        <Text style={styles.rowText} numberOfLines={2}>
                          {translateNotification(t, item.message)}
                        </Text>
                      </View>
                      <Text style={styles.rowTime}>{relativeTime(t, item.created_at)}</Text>
                    </>
                  );

                  if (!item.record_id) {
                    return (
                      <View key={item.id} style={[styles.row, last ? styles.rowLast : null]}>
                        {row}
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => openRecord(item)}
                      accessibilityRole="button"
                      accessibilityLabel={item.record_title ?? t("Update")}
                      style={({ pressed }) => [
                        styles.row,
                        last ? styles.rowLast : null,
                        pressed ? styles.rowPressed : null,
                      ]}
                    >
                      {row}
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.page },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
    headerText: { flex: 1, minWidth: 0 },
    heading: { ...type.title },
    subline: { ...type.caption, marginTop: 2 },
    markAll: { paddingVertical: 6, paddingHorizontal: 2, minHeight: 36, justifyContent: "center" },
    markAllText: { fontSize: 13, fontWeight: "600", color: colors.primaryDark },

    enableBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    enableBody: { flex: 1, minWidth: 0 },
    enableTitle: { fontSize: 13, fontWeight: "600", color: colors.primaryDark },
    enableText: { fontSize: 12, color: colors.primaryDark, marginTop: 1 },
    enableBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    },
    enableBtnText: { fontSize: 12, fontWeight: "600", color: colors.onTint },

    section: { marginTop: spacing.lg },
    sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
    sectionLabel: {
      ...type.label,
      marginBottom: 0,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    countBadge: {
      minWidth: 18,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radius.full,
      backgroundColor: colors.rejectedSoft,
      alignItems: "center",
    },
    countText: { fontSize: 11, fontWeight: "700", color: colors.rejectedInk },

    attentionCard: { borderLeftWidth: 3, borderLeftColor: colors.rejected },
    attentionHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    attentionTitleWrap: { flex: 1, minWidth: 0 },
    attentionTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
    attentionMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
    quote: {
      marginTop: spacing.sm,
      paddingLeft: spacing.sm,
      borderLeftWidth: 2,
      borderLeftColor: colors.rejectedSoft,
    },
    quoteText: { fontSize: 13, lineHeight: 19, color: colors.ink },

    rowActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },

    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
      minHeight: 56,
    },
    rowLast: { borderBottomWidth: 0 },
    rowPressed: { backgroundColor: colors.panel },
    rowIcon: {
      width: 26,
      height: 26,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowTitle: { fontSize: 14, color: colors.ink, flexShrink: 1 },
    rowTitleUnread: { fontWeight: "600" },
    rowText: { fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 2 },
    rowTime: { fontSize: 11, color: colors.faint, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },

    muted: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
    emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, marginTop: spacing.sm },
  });
