// Gentle opacity pulse so the worker knows the phone is actively analyzing a
// photo. Built on React Native's Animated with the native driver - no extra
// dependency, no JS-thread work.
//
// A pulse is decoration, so reduced motion turns it into a steady label: the
// words still say the phone is working, nothing moves.
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useI18n } from "../i18n";
import { useReduceMotion } from "../lib/useReduceMotion";
import { colors, radius, spacing, type } from "../theme";

export type AIAnalyzingPulseProps = {
  label?: string;
};

export function AIAnalyzingPulse({ label }: AIAnalyzingPulseProps) {
  const { t } = useI18n();
  const reduceMotion = useReduceMotion();
  const pulseAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0.4)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
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
    );

    loop.start();
    // Stopping the loop matters: a running Animated.loop keeps ticking (and
    // holding the value) after the card is gone.
    return () => loop.stop();
  }, [pulseAnim, reduceMotion]);

  return (
    <Animated.View
      style={[styles.wrap, { opacity: pulseAnim }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t("AI is analyzing hazard photo...")}
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
