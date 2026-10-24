// Placeholder shown while the AI reads a photo.
//
// The three bars stand in for the fields the review sheet will fill, so the
// screen keeps looking alive during the 3-5 second wait instead of freezing on
// a disabled button. Built on React Native's Animated with the native driver:
// no extra dependency, and no work on the JS thread.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { useI18n } from "../i18n";
import { useReduceMotion } from "../lib/useReduceMotion";
import { colors, radius, spacing, type } from "../theme";

// Widths are uneven on purpose: equal bars read as a loading table, uneven ones
// read as "a title, a name, a paragraph".
const BARS: { id: string; width: DimensionValue; delay: number }[] = [
  { id: "title", width: "62%", delay: 0 },
  { id: "name", width: "44%", delay: 120 },
  { id: "notes", width: "92%", delay: 240 },
];

export function AiSkeleton() {
  const { t } = useI18n();
  const reduceMotion = useReduceMotion();

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={t("Reading the photo...")}
    >
      <View style={styles.bars}>
        {BARS.map((bar) => (
          <Bar key={bar.id} width={bar.width} delay={bar.delay} still={reduceMotion} />
        ))}
      </View>
      <Text style={styles.label}>{t("Reading the photo...")}</Text>
    </View>
  );
}

function Bar({
  width,
  delay,
  still,
}: {
  width: DimensionValue;
  delay: number;
  still: boolean;
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (still) {
      opacity.setValue(0.6);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 620,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [delay, still, opacity]);

  return <Animated.View style={[styles.bar, { width, opacity }]} />;
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, gap: spacing.sm },
  bars: { gap: 7 },
  bar: { height: 11, borderRadius: radius.sm, backgroundColor: colors.line },
  label: { ...type.caption, color: colors.faint },
});
