import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { fetchNotifications } from "../lib/api";
import { ensureNotificationPermission, markAllRead, presentUnreadNotifications } from "../lib/notifications";
import { Button, Card, Pill, SectionTitle } from "../components/ui";
import { colors } from "../theme";
import { formatDateTime } from "../lib/format";
import type { AppNotification } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Alerts">;

let presentedThisSession = false;

export function NotificationsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setItems(await fetchNotifications(profile.id));
    } catch {
      // offline
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Show unread ones as phone notifications once per app session.
      if (profile && !presentedThisSession) {
        presentedThisSession = true;
        presentUnreadNotifications(profile.id).catch(() => undefined);
      }
    }, [profile, load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function markRead() {
    if (!profile) return;
    setBusy(true);
    await markAllRead(profile.id);
    await load();
    setBusy(false);
  }

  async function enableAlerts() {
    await ensureNotificationPermission();
    if (profile) await presentUnreadNotifications(profile.id);
  }

  const unread = items.filter((i) => !i.read_at).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Notifications</Text>
        {unread > 0 ? <Pill label={`${unread} new`} color={colors.hazard} background={colors.hazardSoft} /> : null}
      </View>

      <View style={styles.actions}>
        <Button title="Enable phone alerts" variant="secondary" onPress={enableAlerts} style={styles.actionBtn} />
        <View style={{ width: 10 }} />
        <Button
          title={busy ? "Marking..." : "Mark all read"}
          variant="secondary"
          onPress={markRead}
          loading={busy}
          style={styles.actionBtn}
        />
      </View>

      <View style={{ height: 12 }} />

      {items.length === 0 ? (
        <Card>
          <Text style={styles.muted}>
            No notifications yet. You will be told here when a supervisor approves or rejects one of your records.
          </Text>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id} style={{ marginBottom: 10 }}>
            <View style={styles.itemHeader}>
              <SectionTitle>Review update</SectionTitle>
              {!item.read_at ? <View style={styles.dot} /> : null}
            </View>
            <Text style={styles.body}>{item.message}</Text>
            <Text style={styles.meta}>{formatDateTime(item.created_at)}</Text>
            {item.record_id ? (
              <View style={{ height: 8 }} />
            ) : null}
            {item.record_id ? (
              <Button
                title="Open record"
                variant="secondary"
                onPress={() => navigation.navigate("RecordDetails", { id: item.record_id as string })}
              />
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 20, fontWeight: "800", color: colors.ink },
  actions: { flexDirection: "row", marginTop: 14 },
  actionBtn: { flex: 1 },
  itemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.hazard },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19 },
});
