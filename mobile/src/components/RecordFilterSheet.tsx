// All of the My records filters in one sheet. The three groups are kept apart
// because they answer different questions: a review status, the kind of record,
// and whether a hazard job still needs doing.
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { radius, spacing, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";
import { Button, ChipGroup } from "./ui";

export const STATUS_FILTERS = ["all", "pending", "approved", "rejected"] as const;
export const TYPE_FILTERS = ["all", "flora", "soil_water", "hazard"] as const;
export const COMPLETION_FILTERS = ["all", "open", "done"] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];
export type TypeFilter = (typeof TYPE_FILTERS)[number];
export type CompletionFilter = (typeof COMPLETION_FILTERS)[number];

export interface RecordFiltersValue {
  status: StatusFilter;
  type: TypeFilter;
  completion: CompletionFilter;
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All types",
  flora: "Flora",
  soil_water: "Soil & water",
  hazard: "Hazard",
};

const COMPLETION_LABELS: Record<CompletionFilter, string> = {
  all: "All",
  open: "Incomplete",
  done: "Completed",
};

export function RecordFilterSheet({
  visible,
  status,
  type: recordType,
  completion,
  onClose,
  onApply,
}: {
  visible: boolean;
  status: StatusFilter;
  type: TypeFilter;
  completion: CompletionFilter;
  onClose: () => void;
  onApply: (next: RecordFiltersValue) => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  // The sheet edits a draft so closing it (or tapping the backdrop) leaves the
  // list exactly as it was.
  const [draftStatus, setDraftStatus] = useState<StatusFilter>(status);
  const [draftType, setDraftType] = useState<TypeFilter>(recordType);
  const [draftCompletion, setDraftCompletion] = useState<CompletionFilter>(completion);

  useEffect(() => {
    if (!visible) return;
    setDraftStatus(status);
    setDraftType(recordType);
    setDraftCompletion(completion);
  }, [visible, status, recordType, completion]);

  // Completion only means something for a hazard report: the other record
  // types have no job to finish.
  const completionAvailable = draftType === "all" || draftType === "hazard";
  const completionChosen = draftCompletion !== "all";

  function chooseType(next: TypeFilter) {
    setDraftType(next);
    if (next !== "all" && next !== "hazard") setDraftCompletion("all");
  }

  function chooseCompletion(next: CompletionFilter) {
    setDraftCompletion(next);
    // An unfinished or finished job is always an approved hazard, so pairing it
    // with a review-status chip would contradict itself. Lock the status to All.
    if (next !== "all") setDraftStatus("all");
  }

  function reset() {
    setDraftStatus("all");
    setDraftType("all");
    setDraftCompletion("all");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("Filters")}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("Close")}
              style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
            >
              <Ionicons name="close" size={21} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.group}>
              <Text style={styles.groupTitle}>{t("Status")}</Text>
              <ChipGroup
                options={[...STATUS_FILTERS]}
                value={draftStatus}
                onChange={(value) => setDraftStatus(value as StatusFilter)}
                labelFor={(value) => t(STATUS_LABELS[value as StatusFilter])}
                disabled={completionChosen}
              />
              {completionChosen ? (
                <Text style={styles.hint}>
                  {t("Completion filters use the job state, so the review status is set to all.")}
                </Text>
              ) : null}
            </View>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>{t("Type")}</Text>
              <ChipGroup
                options={[...TYPE_FILTERS]}
                value={draftType}
                onChange={(value) => chooseType(value as TypeFilter)}
                labelFor={(value) => t(TYPE_LABELS[value as TypeFilter])}
              />
            </View>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>{t("Completion")}</Text>
              <ChipGroup
                options={[...COMPLETION_FILTERS]}
                value={draftCompletion}
                onChange={(value) => chooseCompletion(value as CompletionFilter)}
                labelFor={(value) => t(COMPLETION_LABELS[value as CompletionFilter])}
                disabled={!completionAvailable}
              />
              <Text style={styles.hint}>{t("Only hazard reports have a job to finish.")}</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={t("Reset")}
              variant="secondary"
              onPress={reset}
              style={styles.footerButton}
            />
            <Button
              title={t("Apply")}
              onPress={() =>
                onApply({
                  status: draftStatus,
                  type: draftType,
                  completion: draftCompletion,
                })
              }
              style={styles.footerButton}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 32, 24, 0.35)",
      justifyContent: "flex-end",
      padding: spacing.lg,
    },
    sheet: {
      maxHeight: "85%",
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderCurve: "continuous",
      padding: spacing.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    title: { ...type.heading, fontSize: 17 },
    scroll: { flexShrink: 1 },
    body: { gap: spacing.lg, paddingBottom: spacing.xs },
    group: { gap: spacing.sm },
    groupTitle: { ...type.label, fontSize: 12 },
    hint: { ...type.caption, lineHeight: 17 },
    footer: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    footerButton: { flex: 1 },
});
