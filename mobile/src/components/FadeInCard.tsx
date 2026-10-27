// Slides content up from the bottom while fading in — perfect for new cards,
// modal sheets, or the AI review sheet appearing. Built on React Native's
// Animated with the native driver: no extra dependency, no JS-thread work.
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export type FadeInCardProps = {
  children: React.ReactNode;
  style?: any;
  duration?: number;
};

export function FadeInCard({
  children,
  style,
  duration = 300,
}: FadeInCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [duration]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {},
});
