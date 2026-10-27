// Gentle opacity pulse so the worker knows the phone is actively analyzing a
// photo. Built on React Native's Animated with the native driver — no extra
// dependency, no JS-thread work.
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n";
import { colors, radius, spacing, type } from "../theme";

export type AIAnalyzingPulseProps = {
  label?: string;
};

export function AIAnalyzingPulse({ label }: AIAnalyzingPulseProps) {
  const { t } = useI18n();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
    return () => pulseAnim.setValue(0.4);
  }, [t, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity: pulseAnim },
      ]}
    >
      <Text style={styles.text}>{label ?? t("AI is analyzing hazard photo...")}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 12,
    backgroundColor: colors.approvedSoft,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  text: {
    ...type.body,
    color: colors.approvedInk,
    fontWeight: "600",
  },
});
