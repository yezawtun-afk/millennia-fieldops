// Review sheet for the AI photo assistant. Nothing is written to the form
// until the worker taps Apply, and the parent keeps any field they already
// filled in. The rows change with the record type.
import React from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { SEVERITY_LABELS } from "../lib/format";
import type { AiSuggestion } from "../lib/ai";
import { Banner, Button, Card } from "./ui";
import { colors, radius, spacing, type } from "../theme";

interface Row {
  label: string;
  value: string;
  muted: boolean;
}

export function AiSuggestionSheet({
  visible,
  photoUri,
  suggestion,
  onClose,
  onApply,
}: {
  visible: boolean;
  photoUri: string | null;
  suggestion: AiSuggestion | null;
  onClose: () => void;
  onApply: (suggestion: AiSuggestion) => void;
}) {
  const { t } = useI18n();

  if (!visible || !suggestion) return null;

  const percent = Math.round(suggestion.confidence * 100);
  const lowConfidence = suggestion.confidence < 0.65;
  const rows = buildRows(suggestion, t);

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
              {t("AI is not confident. Please check every suggestion carefully.")}
            </Banner>
          ) : null}

          <Card padded>
            {rows.map((row, index) => (
              <SuggestionRow
                key={row.label}
                label={row.label}
                value={row.value}
                muted={row.muted}
                last={index === rows.length - 1}
              />
            ))}
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

function buildRows(suggestion: AiSuggestion, t: (text: string) => string): Row[] {
  const rows: Row[] = [];
  const undetermined = t("Not determined");

  if (suggestion.recordType === "hazard") {
    rows.push(
      {
        label: t("Suggested title"),
        value: suggestion.title || undetermined,
        muted: !suggestion.title,
      },
      {
        label: t("Suggested category"),
        value: suggestion.hazard_type || undetermined,
        muted: !suggestion.hazard_type,
      },
      {
        label: t("Suggested severity"),
        value: suggestion.severity ? t(SEVERITY_LABELS[suggestion.severity]) : undetermined,
        muted: !suggestion.severity,
      }
    );
  } else if (suggestion.recordType === "flora") {
    rows.push(
      {
        label: t("Suggested title"),
        value: suggestion.title || undetermined,
        muted: !suggestion.title,
      },
      {
        label: t("Suggested species"),
        value: suggestion.species_name || undetermined,
        muted: !suggestion.species_name,
      },
      {
        label: t("Suggested growth stage"),
        value: suggestion.growth_stage ? t(suggestion.growth_stage) : undetermined,
        muted: !suggestion.growth_stage,
      },
      {
        label: t("Suggested health condition"),
        value: suggestion.health_condition ? t(suggestion.health_condition) : undetermined,
        muted: !suggestion.health_condition,
      },
      {
        label: t("Suggested estimated count"),
        value: suggestion.estimated_count ? String(suggestion.estimated_count) : undetermined,
        muted: !suggestion.estimated_count,
      }
    );
  }

  rows.push({
    label: t("Suggested notes"),
    value: suggestion.notes || undetermined,
    muted: !suggestion.notes,
  });

  return rows;
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
