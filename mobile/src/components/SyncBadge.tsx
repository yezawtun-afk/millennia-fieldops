// The visual sync state, in two sizes: the card on Home and the one-line
// summary in the side panel.
//
// Four states, not three: a failed upload is not the same as "still waiting",
// and hiding it would leave a field worker guessing.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { useReduceMotion } from "../lib/useReduceMotion";
import { radius, spacing, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";
import type { SyncStatus } from "../context/SyncContext";

type Props = {
  status: SyncStatus;
  remaining: number;
  queued: number;
  failed: number;
  online: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  onSync: () => void;
  variant?: "card" | "compact";
};

export function SyncBadge({
  status,
  remaining,
  queued,
  failed,
  online,
  syncing,
  lastSyncedAt,
  onSync,
  variant = "card",
}: Props) {
  const { t } = useI18n();
  const reduceMotion = useReduceMotion();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  // A short pop when an upload finishes. The card would otherwise just change
  // colour, which is easy to miss while the worker is looking at the form.
  const pop = useRef(new Animated.Value(1)).current;
  const previousStatus = useRef(status);

  useEffect(() => {
    const was = previousStatus.current;
    previousStatus.current = status;

    // Only on the change into "synced", never on a re-render or first mount.
    if (status !== "synced" || was === "synced" || reduceMotion) return;

    pop.setValue(0.82);
    const animation = Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.16,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 230,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [status, reduceMotion, pop]);

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

  if (variant === "compact") {
    return (
      <Pressable
        onPress={onSync}
        disabled={!online || syncing}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${detail}`}
        style={({ pressed }) => [styles.compact, pressed && online ? { opacity: 0.7 } : null]}
      >
        <Animated.View
          style={[styles.dot, { backgroundColor: palette.fg, transform: [{ scale: pop }] }]}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.compactTitle, { color: palette.fg }]}>{title}</Text>
          <Text style={styles.compactDetail} numberOfLines={2}>
            {detail}
            {when ? ` · ${relativeTime(t, lastSyncedAt!)}` : ""}
          </Text>
        </View>
        {online && (remaining > 0 || syncing) ? (
          <Text style={styles.compactAction}>{syncing ? t("Syncing...") : t("Sync now")}</Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={[styles.syncCard, { backgroundColor: palette.bg }]}>
      <View style={styles.syncTop}>
        <Animated.View style={[styles.syncIcon, { transform: [{ scale: pop }] }]}>
          <Ionicons name={palette.icon} size={18} color={palette.fg} />
        </Animated.View>
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

function relativeTime(
  t: (text: string, params?: Record<string, string | number>) => string,
  iso: string
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("just now");
  if (minutes < 60) return t("{count}m ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{count}h ago", { count: hours });
  return new Date(iso).toLocaleDateString();
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
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
    syncAction: {
      fontSize: 13,
      fontWeight: "600",
      marginTop: spacing.sm,
      textDecorationLine: "underline",
    },
  
    compact: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    compactTitle: { fontSize: 13, fontWeight: "600" },
    compactDetail: { ...type.caption, marginTop: 1, lineHeight: 16 },
    compactAction: { fontSize: 12, fontWeight: "600", color: colors.primary, marginTop: 1 },
});
