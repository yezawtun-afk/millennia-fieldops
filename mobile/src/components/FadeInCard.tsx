// Slides content up from the bottom while fading in - for new cards and modal
// sheets, so they arrive instead of flashing onto the screen.
//
// Built on React Native's Animated with the native driver: no extra dependency,
// no JS-thread work. When the phone asks for reduced motion the content is
// simply there at its final position - the arrival is decoration, the content
// is the point.
import React, { useEffect, useRef } from "react";
import {
  Animated,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useReduceMotion } from "../lib/useReduceMotion";

export type FadeInCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
};

export function FadeInCard({
  children,
  style,
  duration = 300,
}: FadeInCardProps) {
  const reduceMotion = useReduceMotion();
  const fadeAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 20)).current;

  useEffect(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      translateY.setValue(0);
      return;
    }

    const animation = Animated.parallel([
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
    ]);

    animation.start();
    // Leaving mid-flight must not leave a timer holding the unmounted card.
    return () => animation.stop();
  }, [duration, fadeAnim, reduceMotion, translateY]);

  return (
    <Animated.View
      style={[{ opacity: fadeAnim, transform: [{ translateY }] }, style]}
    >
      {children}
    </Animated.View>
  );
}
