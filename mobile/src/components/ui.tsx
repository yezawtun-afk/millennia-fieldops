import React, { useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { colors, radius, spacing, type } from "../theme";

// ---- Screen / layout ------------------------------------------------------

// A grouped surface: white, continuous corners, no heavy border. Rows inside
// are separated by hairlines rather than each getting its own card.
export function Card({
  children,
  style,
  padded,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Use for a card that holds a form or prose rather than full-bleed rows. */
  padded?: boolean;
}) {
  return <View style={[styles.card, padded ? styles.cardPadded : null, style]}>{children}</View>;
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  if (!action) return <Text style={styles.sectionTitle}>{children}</Text>;
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// A tappable row inside a grouped card: identity and one supporting line,
// chevron on the right.
export function ListRow({
  title,
  meta,
  right,
  icon,
  onPress,
  last,
}: {
  title: string;
  meta?: string;
  right?: React.ReactNode;
  icon?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [
        styles.listRow,
        !last && styles.listRowLine,
        pressed && onPress ? { backgroundColor: colors.panel } : null,
      ]}
    >
      {icon ? <View style={styles.listRowIcon}>{icon}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.listRowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.faint} style={{ marginLeft: 4 }} />
      ) : null}
    </Pressable>
  );
}

// A single readout in a divided strip: label above, figure below.
export function StatCell({
  label,
  value,
  tone = colors.ink,
  last,
}: {
  label: string;
  value: number | string;
  tone?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.statCell, !last && styles.statCellLine]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

// ---- Text input -----------------------------------------------------------

export function Input({
  trailing,
  ...props
}: TextInputProps & {
  /** A control drawn inside the right edge of the field, such as an eye. */
  trailing?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const field = (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[
        styles.input,
        props.multiline ? styles.inputMultiline : null,
        trailing ? styles.inputWithTrailing : null,
        focused ? styles.inputFocused : null,
        props.style,
      ]}
    />
  );

  // A field with no accessory keeps its plain single-node shape.
  if (!trailing) return field;

  return (
    <View style={styles.inputShell}>
      {field}
      <View style={styles.inputTrailing}>{trailing}</View>
    </View>
  );
}

// A search field: a magnifier inside the left edge and a clear button on the
// right once something is typed. The text is passed through unchanged; the
// caller decides how to match it (for example, case-insensitively).
export function SearchInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
}) {
  const { t } = useI18n();

  return (
    <View>
      <View pointerEvents="none" style={styles.searchIcon}>
        <Ionicons name="search" size={17} color={colors.faint} />
      </View>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchField}
        trailing={
          value.length > 0 ? (
            <Pressable
              onPress={() => onChangeText("")}
              accessibilityRole="button"
              accessibilityLabel={t("Clear search")}
              hitSlop={4}
              style={({ pressed }) => [styles.searchClear, pressed ? { opacity: 0.6 } : null]}
            >
              <Ionicons name="close-circle" size={18} color={colors.faint} />
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}

// ---- Buttons --------------------------------------------------------------

const buttonVariants = {
  primary: { bg: colors.primary, fg: colors.onTint, border: colors.primary },
  secondary: { bg: colors.card, fg: colors.ink, border: colors.control },
  ghost: { bg: "transparent", fg: colors.ink, border: "transparent" },
  danger: { bg: colors.rejected, fg: colors.onTint, border: colors.rejected },
} as const;

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
  variant?: keyof typeof buttonVariants;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const palette = buttonVariants[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: inactive ? 0.45 : pressed ? 0.75 : 1,
        },
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
    <View style={[styles.pill, { backgroundColor: background }]}>
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
  labelFor,
}: {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  /** Display text for an option whose stored value must stay unchanged. */
  labelFor?: (option: string) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {labelFor ? labelFor(option) : option}
            </Text>
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
      ? { bg: colors.rejectedSoft, fg: colors.rejectedInk, icon: "alert-circle-outline" as const }
      : kind === "success"
        ? { bg: colors.approvedSoft, fg: colors.approvedInk, icon: "checkmark-circle-outline" as const }
        : kind === "warning"
          ? { bg: colors.pendingSoft, fg: colors.pendingInk, icon: "time-outline" as const }
          : { bg: colors.primarySoft, fg: colors.primaryDark, icon: "information-circle-outline" as const };

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <Ionicons name={palette.icon} size={16} color={palette.fg} />
      <Text style={[styles.bannerText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  cardPadded: { padding: spacing.lg },
  sectionTitle: { ...type.heading, fontSize: 15 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  label: { ...type.label, marginBottom: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    minHeight: 56,
  },
  listRowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  listRowIcon: { width: 32, alignItems: "center" },
  listRowTitle: { ...type.body, fontSize: 15, fontWeight: "500" },
  listRowMeta: { ...type.caption, marginTop: 1 },
  statCell: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  statCellLine: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  statLabel: { ...type.label, fontSize: 11 },
  statValue: { ...type.number, fontSize: 22, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.control,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 46,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  inputFocused: { borderColor: colors.primary },
  inputMultiline: { minHeight: 88, textAlignVertical: "top" },
  inputShell: { justifyContent: "center" },
  inputWithTrailing: { paddingRight: 44 },
  inputTrailing: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  searchField: { paddingLeft: 38 },
  searchClear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  button: {
    borderWidth: 1,
    borderRadius: radius.md,
    borderCurve: "continuous",
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 15, fontWeight: "600" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 11, fontWeight: "500" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.control,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 38,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextSelected: { color: colors.primaryDark, fontWeight: "600" },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  emptyTitle: { ...type.body, fontWeight: "500" },
  emptyHint: { ...type.caption, marginTop: 4, textAlign: "center" },
});
