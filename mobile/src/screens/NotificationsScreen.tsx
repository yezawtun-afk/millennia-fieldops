import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { fetchNotifications } from "../lib/api";
import { ensureNotificationPermission, markAllRead, presentUnreadNotifications } from "../lib/notifications";
import { useI18n, translateNotification } from "../i18n";
import { Button, Card, Pill, SectionTitle } from "../components/ui";
import { radius, spacing, type Palette, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";
import { formatDateTime } from "../lib/format";
import type { AppNotification } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Alerts">;
type Bucket = "all" | "unread" | "read";
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

function accentForMessage(colors: Palette, msg: string): {
  bg: string;
  fg: string;
  icon: "checkmark-circle" | "close-circle" | "notifications";
  /** English key for the small pill above the message; translated at render. */
  label: string;
} {
  const lower = msg.toLowerCase();
  if (lower.includes("approved") || lower.includes("verified")) {
    return {
      bg: colors.approvedSoft,
      fg: colors.approved,
      icon: "checkmark-circle",
      label: lower.includes("verified") ? "Verified" : "Approved",
    };
  }
  if (lower.includes("rejected") || lower.includes("sent back")) {
    return {
      bg: colors.rejectedSoft,
      fg: colors.rejected,
      icon: "close-circle",
      label: lower.includes("sent back") ? "Sent back" : "Rejected",
    };
  }
  if (lower.includes("assigned")) {
    return { bg: colors.primarySoft, fg: colors.primary, icon: "notifications", label: "Assigned" };
  }
  return { bg: colors.primarySoft, fg: colors.primary, icon: "notifications", label: "Update" };
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
  const [filter, setFilter] = useState<Bucket>("all");

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
    }, [load])
  );

  const filtered = useMemo(() => {
    if (filter === "unread") return items.filter((i) => !i.read_at);
    if (filter === "read") return items.filter((i) => !!i.read_at);
    return items;
  }, [items, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const item of filtered) {
      const key = dayBucket(t, item.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filtered, t]);

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

  async function dismiss(item: AppNotification) {
    if (item.read_at) return;
    try {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id);
    } catch {
      // ignore - server triggers will mirror eventually
    }
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
    );
  }

  async function enableAlerts() {
    await ensureNotificationPermission();
    if (userId) await presentUnreadNotifications(userId);
  }

  const unread = items.filter((i) => !i.read_at).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>{t("Notifications")}</Text>
          <Text style={styles.subline}>
            {t("{unread} unread · {total} total", { unread, total: items.length })}
          </Text>
        </View>
        {unread > 0 ? (
          <Pill
            label={t("{count} new", { count: unread })}
            color={colors.rejectedInk}
            background={colors.rejectedSoft}
          />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          title={t("Enable phone alerts")}
          variant="secondary"
          onPress={enableAlerts}
          style={styles.actionBtn}
        />
        <Button
          title={busy ? t("Marking...") : t("Mark all read")}
          variant="secondary"
          onPress={markRead}
          loading={busy}
          style={styles.actionBtn}
        />
      </View>

      <View style={styles.chipsRow}>
        {(["all", "unread", "read"] as Bucket[]).map((b) => (
          <Pressable
            key={b}
            onPress={() => setFilter(b)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === b }}
            style={({ pressed }) => [
              styles.chip,
              filter === b && styles.chipActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.chipText, filter === b && styles.chipTextActive]}>
              {b === "all" ? t("All") : b === "unread" ? t("Unread") : t("Read")}
            </Text>
          </Pressable>
        ))}
      </View>

      {items.length === 0 ? (
        <Card padded>
          <Ionicons name="notifications-off-outline" size={26} color={colors.muted} />
          <Text style={styles.emptyTitle}>{t("No notifications yet")}</Text>
          <Text style={styles.muted}>
            {t("You will be alerted here when a supervisor approves or rejects one of your records.")}
          </Text>
        </Card>
      ) : filtered.length === 0 ? (
        <Card padded>
          <Text style={styles.muted}>{t("Nothing to show in this filter.")}</Text>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([title, rows]) => (
          <View key={title} style={{ marginBottom: spacing.md }}>
            <SectionTitle>{title}</SectionTitle>
            <View style={{ gap: spacing.sm }}>
              {rows.map((item) => {
                const { bg, fg, icon, label } = accentForMessage(colors, item.message);
                return (
                  <Card key={item.id} padded>
                    <View style={styles.itemHeader}>
                      <View style={[styles.leftBadge, { backgroundColor: bg, borderRadius: radius.full }]}>
                        <Ionicons name={icon} size={14} color={fg} />
                        <Text style={[styles.statusText, { color: fg }]}>{t(label)}</Text>
                      </View>
                      <View style={styles.itemHeadRight}>
                        {!item.read_at ? <View style={styles.dot} /> : null}
                        <Pill
                          label={relativeTime(t, item.created_at)}
                          color={colors.muted}
                          background={colors.panel}
                        />
                      </View>
                    </View>
                    <Text style={styles.body}>{translateNotification(t, item.message)}</Text>
                    {item.record_id ? (
                      <View style={styles.rowActions}>
                        <Button
                          title={t("Open record")}
                          variant="secondary"
                          onPress={() =>
                            navigation.navigate("RecordDetails", { id: item.record_id as string })
                          }
                          style={{ flex: 1 }}
                        />
                        {!item.read_at ? (
                          <Pressable
                            style={styles.dismissBtn}
                            onPress={() => dismiss(item)}
                            accessibilityRole="button"
                          >
                            <Ionicons name="checkmark" size={17} color={colors.muted} />
                            <Text style={styles.dismissText}>{t("Mark read")}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.page },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    heading: { ...type.title },
    subline: { ...type.caption, marginTop: 2 },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    actionBtn: { flex: 1 },
    chipsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.control,
      minHeight: 36,
      justifyContent: "center",
    },
    chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.ink, fontWeight: "500" },
    chipTextActive: { color: colors.primaryDark, fontWeight: "600" },
    itemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    leftBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 3 },
    statusText: { fontSize: 11, fontWeight: "600" },
    itemHeadRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.rejected },
    body: { fontSize: 14, color: colors.ink, lineHeight: 20, marginTop: spacing.sm },
    muted: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
    emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, marginTop: spacing.sm },
    rowActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
    dismissBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 8, paddingHorizontal: 10 },
    dismissText: { fontSize: 12, fontWeight: "500", color: colors.muted },
});
