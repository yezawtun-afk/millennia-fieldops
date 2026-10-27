// A tappable card with a subtle scale-down on press — gives every button an
// instant, tactile native feel without any external animation library.
//
// Usage: wrap any card-like Pressable content; the scale transform is applied
// through the Pressable style function so it tracks the pressed state natively.
// The base style is intentionally minimal — callers provide their own colors,
// padding, and borders via the `style` prop (merged last).
import React from "react";
import { Pressable, StyleSheet, type ViewStyle } from "react-native";

export type BouncyCardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
  accessibilityLabel?: string;
};

export function BouncyCard({
  children,
  onPress,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: BouncyCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        disabled && { opacity: 0.5 },
        pressed && {
          transform: [{ scale: 0.97 }],
          opacity: 0.9,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {},
});
