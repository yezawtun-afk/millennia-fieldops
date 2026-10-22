// Language switch: a small globe that opens a sheet with the three languages.
// A sheet rather than Alert.alert because Android only shows three buttons in
// an alert, and we need three choices plus cancel.
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LOCALES, useI18n } from "../i18n";
import { colors, radius, spacing, type } from "../theme";

export function LanguageButton({ tint = colors.muted }: { tint?: string }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((item) => item.value === locale) ?? LOCALES[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("Change language")}
        hitSlop={10}
        style={styles.trigger}
      >
        <Ionicons name="language-outline" size={16} color={tint} />
        <Text style={[styles.triggerText, { color: tint }]}>{current.short}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.title}>{t("Language")}</Text>
            {LOCALES.map((item) => {
              const selected = item.value === locale;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    setLocale(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    selected && styles.rowSelected,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.rowText, selected && styles.rowTextSelected]}>
                    {item.label}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setOpen(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>{t("Cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.control,
  },
  triggerText: { fontSize: 12, fontWeight: "600" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 32, 24, 0.35)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: { ...type.subhead, fontWeight: "600", color: colors.ink, marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  rowSelected: { backgroundColor: colors.primarySoft },
  rowText: { fontSize: 15, color: colors.ink },
  rowTextSelected: { fontWeight: "600", color: colors.primaryDark },
  cancel: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.xs },
  cancelText: { fontSize: 14, fontWeight: "500", color: colors.muted },
});
