import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { fetchNotifications } from "../lib/api";
import { ensureNotificationPermission, markAllRead, presentUnreadNotifications } from "../lib/notifications";
import { Button, Card, Pill, SectionTitle } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import { formatDateTime } from "../lib/format";
import type { AppNotification } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Alerts">;
type Bucket = "all" | "unread" | "read";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return formatDateTime(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDateTime(iso);
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return formatDateTime(iso);
}

function accentForMessage(msg: string): { bg: string; fg: string; icon: "checkmark-circle" | "close-circle" | "notifications" } {
  const lower = msg.toLowerCase();
  if (lower.includes("approved")) return { bg: colors.approvedSoft ?? "#D1FAE5", fg: colors.approved ?? "#047857", icon: "checkmark-circle" };
  if (lower.includes("rejected")) return { bg: colors.rejectedSoft ?? "#FDECEA", fg: colors.rejected ?? "#B91C1C", icon: "close-circle" };
  return { bg: colors.primarySoft, fg: colors.primary, icon: "notifications" };
}

export function NotificationsScreen({ navigation }: Props) {
  const { profile, session } = useAuth();
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
      const key = dayBucket(item.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filtered]);

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
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)));
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
          <Text style={styles.heading}>Notifications</Text>
          <Text style={styles.subline}>
            {unread} unread · {items.length} total
          </Text>
        </View>
        {unread > 0 ? (
          <Pill label={`${unread} new`} color={colors.rejectedInk} background={colors.rejectedSoft} />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          title="Enable phone alerts"
          variant="secondary"
          onPress={enableAlerts}
          style={styles.actionBtn}
        />
        <Button
          title={busy ? "Marking..." : "Mark all read"}
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
              {b === "all" ? "All" : b === "unread" ? "Unread" : "Read"}
            </Text>
          </Pressable>
        ))}
      </View>

      {items.length === 0 ? (
        <Card padded>
          <Ionicons name="notifications-off-outline" size={26} color={colors.muted} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.muted}>
            You will be alerted here when a supervisor approves or rejects one of your records.
          </Text>
        </Card>
      ) : filtered.length === 0 ? (
        <Card padded>
          <Text style={styles.muted}>Nothing to show in this filter.</Text>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([title, rows]) => (
          <View key={title} style={{ marginBottom: spacing.md }}>
            <SectionTitle>{title}</SectionTitle>
            <View style={{ gap: spacing.sm }}>
              {rows.map((item) => {
                const { bg, fg, icon } = accentForMessage(item.message);
                return (
                  <Card key={item.id} padded>
                    <View style={styles.itemHeader}>
                      <View style={[styles.leftBadge, { backgroundColor: bg, borderRadius: radius.full }]}>
                        <Ionicons name={icon} size={14} color={fg} />
                        <Text style={[styles.statusText, { color: fg }]}>
                          {icon === "checkmark-circle"
                            ? "Approved"
                            : icon === "close-circle"
                              ? "Rejected"
                              : "Update"}
                        </Text>
                      </View>
                      <View style={styles.itemHeadRight}>
                        {!item.read_at ? <View style={styles.dot} /> : null}
                        <Pill label={relativeTime(item.created_at)} color={colors.muted} background={colors.panel} />
                      </View>
                    </View>
                    <Text style={styles.body}>{item.message}</Text>
                    {item.record_id ? (
                      <View style={styles.rowActions}>
                        <Button
                          title="Open record"
                          variant="secondary"
                          onPress={() => navigation.navigate("RecordDetails", { id: item.record_id as string })}
                          style={{ flex: 1 }}
                        />
                        {!item.read_at ? (
                          <Pressable
                            style={styles.dismissBtn}
                            onPress={() => dismiss(item)}
                            accessibilityRole="button"
                          >
                            <Ionicons name="checkmark" size={17} color={colors.muted} />
                            <Text style={styles.dismissText}>Mark read</Text>
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

const styles = StyleSheet.create({
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
