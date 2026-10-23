// The side panel: who you are, the one job that is not a tab (the review
// queue), language, sync, version and log out.
//
// It deliberately does NOT repeat Home / Map / New / My records /
// Notifications: those are one tap away in the bottom bar, so a second copy
// here would only add noise.
//
// Built from Modal + Animated, not @react-navigation/drawer, so it needs no
// native module and can ship over the air to the installed build.
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { countPendingReviews } from "../lib/api";
import { appVersion, applyUpdate, checkForUpdate } from "../lib/updates";
import { LOCALES, useI18n } from "../i18n";
import { ROLE_LABELS } from "../lib/format";
import { colors, radius, shadow, spacing, type } from "../theme";
import { SyncBadge } from "./SyncBadge";

export function Sidebar({
  open,
  onClose,
  onOpenLanguage,
  onOpenReview,
}: {
  open: boolean;
  onClose: () => void;
  onOpenLanguage: () => void;
  onOpenReview: () => void;
}) {
  const { profile, signOut } = useAuth();
  const { locale, t } = useI18n();
  const {
    online,
    syncing,
    queued,
    failed,
    lastSyncedAt,
    status,
    remaining,
    syncNow,
  } = useSync();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const panelWidth = Math.min(320, width * 0.84);
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [reviewCount, setReviewCount] = useState(0);
  const [checking, setChecking] = useState(false);

  const isReviewer = profile?.role === "supervisor" || profile?.role === "admin";
  const initial = profile?.full_name?.trim().charAt(0).toUpperCase() || "?";
  const role = profile ? t(ROLE_LABELS[profile.role]) : "";
  const contact = profile?.phone?.trim() || profile?.email || "";
  const localeShort = LOCALES.find((item) => item.value === locale)?.short ?? "EN";

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reduced) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 230,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!mounted) return;

    if (reduced) {
      progress.setValue(0);
      setMounted(false);
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [open, reduced]);

  // The review count is the only number the panel owns; ask for it when the
  // panel opens rather than keeping another watcher running.
  useEffect(() => {
    if (!open || !isReviewer) return;
    let active = true;
    countPendingReviews()
      .then((count) => {
        if (active) setReviewCount(count);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, isReviewer]);

  async function checkUpdate() {
    if (checking) return;
    setChecking(true);
    const result = await checkForUpdate();
    setChecking(false);
    if (!result.available) {
      Alert.alert(t("Check for update"), t(result.message));
      return;
    }
    Alert.alert(
      t("Update available"),
      t("A newer version of Millennia FieldOps is ready. Restart the app now to use it?"),
      [
        { text: t("Later"), style: "cancel" },
        {
          text: t("Update now"),
          onPress: () => {
            void applyUpdate();
          },
        },
      ]
    );
  }

  function confirmLogout() {
    Alert.alert(t("Log out"), t("Sign out of Millennia FieldOps on this phone?"), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Log out"),
        style: "destructive",
        onPress: () => {
          onClose();
          void signOut();
        },
      },
    ]);
  }

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-panelWidth, 0],
  });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.host}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("Close menu")}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top + 14,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.top}>
            <View style={styles.brandRow}>
              <View style={styles.mark}>
                <Ionicons name="leaf-outline" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.brandTitle}>Millennia FieldOps</Text>
                <Text style={styles.brandSub}>Millennia Village</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("Close menu")}
                style={({ pressed }) => [styles.close, pressed && { opacity: 0.55 }]}
              >
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {profile?.full_name ?? ""}
                </Text>
                <Text style={styles.userMeta} numberOfLines={1}>
                  {role}
                  {contact ? ` · ${contact}` : ""}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              {isReviewer ? (
                <MenuRow
                  icon="checkmark-done-outline"
                  label={t("Review queue")}
                  value={
                    reviewCount > 0 ? (
                      <View style={styles.countPill}>
                        <Text style={styles.countText}>{reviewCount}</Text>
                      </View>
                    ) : undefined
                  }
                  onPress={onOpenReview}
                />
              ) : null}
              <MenuRow
                icon="language-outline"
                label={t("Language")}
                value={<Text style={styles.rowValue}>{localeShort}</Text>}
                onPress={onOpenLanguage}
                last
              />
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.footerCard}>
              <SyncBadge
                variant="compact"
                status={status}
                remaining={remaining}
                queued={queued}
                failed={failed}
                online={online}
                syncing={syncing}
                lastSyncedAt={lastSyncedAt}
                onSync={() => void syncNow()}
              />
            </View>

            <View style={styles.footerCard}>
              <Pressable
                onPress={() => void checkUpdate()}
                accessibilityRole="button"
                style={({ pressed }) => [styles.footerRow, pressed && { backgroundColor: colors.panel }]}
              >
                <Ionicons name="cloud-download-outline" size={18} color={colors.muted} />
                <Text style={styles.footerLabel}>{t("Version")}</Text>
                <Text style={styles.footerValue}>
                  {checking ? t("Checking") : appVersion()}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.faint} />
              </Pressable>
              <View style={styles.hairline} />
              <Pressable
                onPress={confirmLogout}
                accessibilityRole="button"
                style={({ pressed }) => [styles.footerRow, pressed && { backgroundColor: colors.panel }]}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.rejected} />
                <Text style={[styles.footerLabel, { color: colors.rejected }]}>
                  {t("Log out")}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: React.ReactNode;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowLine,
        pressed && { backgroundColor: colors.panel },
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ?? null}
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </Pressable>
  );
}

// The system's "reduce motion" switch: keep the panel arriving, but without
// the slide.
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15, 32, 24, 0.4)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.page,
    boxShadow: shadow.panel,
  },

  top: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: colors.ink, fontSize: 15, fontWeight: "600", lineHeight: 18 },
  brandSub: { color: colors.muted, fontSize: 11, lineHeight: 14 },
  close: { padding: 4 },

  userCard: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primaryDark, fontSize: 16, fontWeight: "700" },
  userName: { fontSize: 15, fontWeight: "600", color: colors.ink },
  userMeta: { ...type.caption, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.ink },
  rowValue: { fontSize: 13, fontWeight: "600", color: colors.primary },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 12, fontWeight: "700", color: colors.primaryDark },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 10 },
  footerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  footerLabel: { flex: 1, fontSize: 14, color: colors.ink },
  footerValue: { fontSize: 13, color: colors.muted, fontVariant: ["tabular-nums"] },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});
