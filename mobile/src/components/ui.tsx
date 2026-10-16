import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius } from "../theme";

// ---- Screen / layout ------------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

// ---- Text input -----------------------------------------------------------

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, props.multiline ? styles.inputMultiline : null, props.style]}
    />
  );
}

// ---- Buttons --------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const palette =
    variant === "primary"
      ? { bg: colors.primary, fg: "#FFFFFF", border: colors.primary }
      : variant === "danger"
        ? { bg: colors.rejected, fg: "#FFFFFF", border: colors.rejected }
        : { bg: colors.card, fg: colors.ink, border: colors.line };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled || loading ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

// ---- Pills ---------------------------------------------------------------

export function Pill({
  label,
  color,
  background,
  icon,
}: {
  label: string;
  color: string;
  background: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={[styles.pill, styles.pillRow, { backgroundColor: background }]}>
      {icon}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

// ---- Chip selector (replaces a dropdown) ----------------------------------

export function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- Banners -------------------------------------------------------------

export function Banner({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "warning" | "success";
  children: React.ReactNode;
}) {
  const palette =
    kind === "error"
      ? { bg: colors.rejectedSoft, fg: colors.rejected }
      : kind === "success"
        ? { bg: colors.approvedSoft, fg: colors.approved }
        : kind === "warning"
          ? { bg: colors.pendingSoft, fg: "#92400E" }
          : { bg: colors.primarySoft, fg: colors.primaryDark };

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.fg, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: "#FFFFFF",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  button: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 15, fontWeight: "700" },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pillText: { fontSize: 12, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextSelected: { color: "#FFFFFF", fontWeight: "600" },
  banner: { borderRadius: radius.md, padding: 12, marginBottom: 12 },
});
