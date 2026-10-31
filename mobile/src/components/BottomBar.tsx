// The bottom bar.
//
// Five destinations with the "New record" action raised in the middle, like a
// field tool held in the hand: the four quiet screens sit flat, the one action
// you came to do stands up. The bar itself stays white and thin; the raised
// button gets a shadow instead of a heavy border.
//
// Review is a route in the navigator but not a button here: it lives in the
// side panel, so nothing appears twice.
import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSync } from "../context/SyncContext";
import { useI18n } from "../i18n";
import { useReduceMotion } from "../lib/useReduceMotion";
import { radius, shadow, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";

const HEADROOM = 20;
const BAR_HEIGHT = 62;
const FAB_SIZE = 56;

type Item = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  badgeColor?: string;
};

export function BottomBar({
  state,
  navigation,
  unread,
}: BottomTabBarProps & { unread: number }) {
  const { t } = useI18n();
  const { drafts } = useSync();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const scale = useRef(new Animated.Value(1)).current;

  const items: Item[] = [
    { route: "Home", label: t("Home"), icon: "home-outline", activeIcon: "home" },
    { route: "Map", label: t("Map"), icon: "map-outline", activeIcon: "map" },
    { route: "New", label: t("New"), icon: "add", activeIcon: "add" },
    {
      route: "Records",
      label: t("My records"),
      icon: "list-outline",
      activeIcon: "list",
      badge: drafts,
      badgeColor: colors.pendingInk,
    },
    {
      route: "Alerts",
      label: t("Notifications"),
      icon: "notifications-outline",
      activeIcon: "notifications",
      badge: unread,
      badgeColor: colors.hazard,
    },
  ];

  const focusedKey = state.routes[state.index].key;

  function go(routeName: string) {
    const route = state.routes.find((item) => item.name === routeName);
    if (!route) return;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (route.key !== focusedKey && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  }

  function pressIn() {
    // The darkening in the Pressable style is the real feedback; the squash is
    // the flourish, so it is the part that goes when motion is reduced.
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: 0.94,
      duration: 110,
      useNativeDriver: true,
    }).start();
  }

  function pressOut() {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: 1,
      speed: 24,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }

  return (
    <View style={styles.root}>
      <View style={styles.headroom} />
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.slots}>
          {items.map((item) => {
            const route = state.routes.find((candidate) => candidate.name === item.route);
            if (!route) return null;
            const focused = route.key === focusedKey;

            if (item.route === "New") {
              return (
                <Pressable
                  key={item.route}
                  onPress={() => go(item.route)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={t("New record")}
                  style={styles.slot}
                >
                  <Text
                    style={[styles.label, focused && styles.labelActive]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.2}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={item.route}
                onPress={() => go(item.route)}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={
                  item.badge && item.badge > 0
                    ? `${item.label}, ${item.badge}`
                    : item.label
                }
                style={({ pressed }) => [styles.slot, pressed && { opacity: 0.55 }]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={focused ? item.activeIcon : item.icon}
                    size={22}
                    color={focused ? colors.primary : colors.muted}
                  />
                  {item.badge && item.badge > 0 ? (
                    <View style={[styles.badge, { backgroundColor: item.badgeColor }]}>
                      <Text style={styles.badgeText} maxFontSizeMultiplier={1.1}>
                        {item.badge > 99 ? "99+" : item.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.label, focused && styles.labelActive]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Animated.View style={[styles.fabWrap, { transform: [{ scale }] }]}>
        <Pressable
          onPress={() => go("New")}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="button"
          accessibilityLabel={t("New record")}
          accessibilityState={{ selected: state.routes[state.index]?.name === "New" }}
          style={({ pressed }) => [styles.fab, pressed && { backgroundColor: colors.primaryDark }]}
        >
          <Ionicons name="add" size={28} color={colors.onTint} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.page,
    },
    headroom: { height: HEADROOM },
    bar: {
      backgroundColor: colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    slots: {
      height: BAR_HEIGHT,
      flexDirection: "row",
      alignItems: "stretch",
    },
    slot: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
      paddingBottom: 9,
      gap: 3,
    },
    iconWrap: { width: 26, height: 22, alignItems: "center", justifyContent: "center" },
    label: { ...type.label, fontSize: 10, lineHeight: 12, color: colors.muted },
    labelActive: { color: colors.primary, fontWeight: "600" },
  
    badge: {
      position: "absolute",
      top: -5,
      right: -10,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: colors.onTint, fontSize: 9, fontWeight: "700" },
  
    fabWrap: {
      position: "absolute",
      top: 0,
      left: "50%",
      marginLeft: -FAB_SIZE / 2,
      width: FAB_SIZE,
      height: FAB_SIZE,
    },
    fab: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: radius.lg + 2,
      borderCurve: "continuous",
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      boxShadow: shadow.fab,
    },
});
