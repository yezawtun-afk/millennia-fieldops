// Review sheet for the hazard-photo assistant. Nothing is written to the form
// until the worker taps Apply, and the parent keeps any field they already
// filled in.
import React from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { SEVERITY_LABELS } from "../lib/format";
import type { HazardAiSuggestion } from "../lib/ai";
import { Banner, Button, Card } from "./ui";
import { colors, radius, spacing, type } from "../theme";

export function AiSuggestionSheet({
  visible,
  photoUri,
  suggestion,
  onClose,
  onApply,
}: {
  visible: boolean;
  photoUri: string | null;
  suggestion: HazardAiSuggestion | null;
  onClose: () => void;
  onApply: (suggestion: HazardAiSuggestion) => void;
}) {
  const { t } = useI18n();

  if (!visible || !suggestion) return null;

  const percent = Math.round(suggestion.confidence * 100);
  const lowConfidence = suggestion.confidence < 0.65;
  const severity = suggestion.severity ? t(SEVERITY_LABELS[suggestion.severity]) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.title}>{t("AI suggestions")}</Text>
            <Text style={styles.sub}>{t("Review before adding them to the form.")}</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("Close")}
            hitSlop={8}
            style={styles.close}
          >
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}

          <View style={styles.confidenceRow}>
            <View
              style={[
                styles.confidenceBadge,
                lowConfidence ? styles.confidenceLow : styles.confidenceGood,
              ]}
            >
              <Ionicons
                name={lowConfidence ? "alert-circle-outline" : "checkmark-circle-outline"}
                size={14}
                color={lowConfidence ? colors.sevMedium : colors.approvedInk}
              />
              <Text
                style={[
                  styles.confidenceText,
                  { color: lowConfidence ? colors.sevMedium : colors.approvedInk },
                ]}
              >
                {t("Confidence {percent}%", { percent })}
              </Text>
            </View>
          </View>

          {lowConfidence ? (
            <Banner kind="warning">
              {t("AI is not confident. Please check the category and severity carefully.")}
            </Banner>
          ) : null}

          <Card padded>
            <SuggestionRow
              label={t("Suggested title")}
              value={suggestion.title || t("Not determined")}
              muted={!suggestion.title}
              last={false}
            />
            <SuggestionRow
              label={t("Suggested category")}
              value={suggestion.hazard_type || t("Not determined")}
              muted={!suggestion.hazard_type}
              last={false}
            />
            <SuggestionRow
              label={t("Suggested severity")}
              value={severity || t("Not determined")}
              muted={!severity}
              last={false}
            />
            <SuggestionRow
              label={t("Suggested notes")}
              value={suggestion.notes || t("Not determined")}
              muted={!suggestion.notes}
              last
            />
          </Card>

          <Text style={styles.helper}>
            {t("AI can be wrong. Check the photo and every field before saving.")}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t("Apply suggestions")}
            onPress={() => onApply(suggestion)}
            style={styles.footerButton}
          />
          <Button
            title={t("Dismiss")}
            variant="secondary"
            onPress={onClose}
            style={styles.footerButton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SuggestionRow({
  label,
  value,
  muted,
  last,
}: {
  label: string;
  value: string;
  muted: boolean;
  last: boolean;
}) {
  return (
    <View style={[styles.row, last ? null : styles.rowLine]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, muted ? styles.rowMuted : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { ...type.title, fontSize: 22 },
  sub: { ...type.subhead, marginTop: 2 },
  close: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.control,
  },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  photo: {
    width: "100%",
    height: 190,
    borderRadius: radius.md,
    backgroundColor: colors.line,
  },
  confidenceRow: { flexDirection: "row" },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 30,
    borderRadius: radius.full,
  },
  confidenceGood: { backgroundColor: colors.approvedSoft },
  confidenceLow: { backgroundColor: colors.sevMediumSoft },
  confidenceText: { fontSize: 12, fontWeight: "600" },
  row: { paddingVertical: 10, gap: 4 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
  rowValue: { ...type.body, fontSize: 15 },
  rowMuted: { color: colors.muted, fontStyle: "italic" },
  helper: { ...type.caption, lineHeight: 17 },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  footerButton: { flex: 1 },
});
