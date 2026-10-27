import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { deleteRecord, fetchRecord, signPhotoUrls } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { openInOpenStreetMap } from "../lib/location";
import { Button, Card, Pill, SectionTitle } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  daysUntilDue,
  formatDate,
  formatDateTime,
  formatDueDate,
  isOverdue,
  SEVERITY_COLORS,
} from "../lib/format";
import type { FieldRecord } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "RecordDetails">;

export function RecordDetailsScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { profile, session } = useAuth();
  const { t } = useI18n();
  const userId = session?.user.id ?? profile?.id ?? null;
  const [record, setRecord] = useState<FieldRecord | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      (async () => {
        const data = await fetchRecord(id);
        if (!active) return;
        setRecord(data);
        if (data && data.photos?.length) {
          setPhotos(await signPhotoUrls(data.photos));
        } else {
          setPhotos([]);
        }
        if (data && data.completion_photos?.length) {
          setCompletionPhotos(await signPhotoUrls(data.completion_photos));
        } else {
          setCompletionPhotos([]);
        }
        setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [id])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>
          {t("This record could not be loaded. You may be offline.")}
        </Text>
      </View>
    );
  }

  const isOwnRecord = Boolean(userId && record.submitted_by === userId);
  const isCompleted = Boolean(record.completed_at);
  // The worker holds the job: the assignee, or the reporter when nobody was
  // assigned. Nobody else may mark it fixed.
  const holdsJob =
    record.type === "hazard" &&
    record.status === "approved" &&
    !record.completed_at &&
    !record.closed_at &&
    Boolean(userId) &&
    (record.assigned_to ?? record.submitted_by) === userId;
  // Your own record, not reviewed yet: you may take it back.
  const canDelete = isOwnRecord && record.status === "pending";

  function confirmDelete() {
    if (!record) return;
    Alert.alert(
      t("Delete record"),
      t('Delete "{title}"? This cannot be undone - the record and its photos are removed for everyone.', {
        title: record.title,
      }),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteRecord(record.id, record.photos ?? []);
              navigation.goBack();
            } catch {
              Alert.alert(
                t("Could not delete"),
                t(
                  "You need a connection to delete an uploaded record, and only records that are still pending can be removed."
                )
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  const facts: { label: string; value: string | null }[] =
    record.type === "flora"
      ? [
          { label: t("Species"), value: record.species_name },
          {
            label: t("Growth stage"),
            value: record.growth_stage ? t(record.growth_stage) : null,
          },
          {
            label: t("Health condition"),
            value: record.health_condition ? t(record.health_condition) : null,
          },
          {
            label: t("Estimated count"),
            value: record.estimated_count != null ? String(record.estimated_count) : null,
          },
        ]
      : record.type === "hazard"
        ? [
            { label: t("Hazard type"), value: record.hazard_type ? t(record.hazard_type) : null },
            { label: t("Severity"), value: record.severity ? t(record.severity) : null },
          ]
        : [
            { label: t("Reading type"), value: record.reading_type ? t(record.reading_type) : null },
            {
              label: t("Value"),
              value:
                record.reading_value != null
                  ? `${record.reading_value}${record.reading_unit ? ` ${record.reading_unit}` : ""}`
                  : null,
            },
          ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.rowLeft}>
        <Pill
          label={t(TYPE_LABELS[record.type])}
          color={TYPE_COLORS[record.type].fg}
          background={TYPE_COLORS[record.type].bg}
        />
        <Pill
          label={t(STATUS_LABELS[record.status])}
          color={STATUS_COLORS[record.status].fg}
          background={STATUS_COLORS[record.status].bg}
        />
        {isCompleted ? (
          <Pill
            label={t("Completed")}
            color={colors.approvedInk}
            background={colors.approvedSoft}
            icon={
              <Ionicons name="checkmark-circle" size={13} color={colors.approvedInk} />
            }
          />
        ) : null}
        {record.type === "hazard" && record.severity ? (
          <Pill
            label={t(record.severity)}
            color={SEVERITY_COLORS[record.severity].fg}
            background={SEVERITY_COLORS[record.severity].bg}
          />
        ) : null}
      </View>

      <Text style={styles.title}>{record.title}</Text>
      <Text style={styles.meta}>
        {record.zone?.name ?? t("No zone")} ·{" "}
        {t("observed {date}", { date: formatDate(record.observed_date) })}
      </Text>

      {record.notes ? (
        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("Notes")}</SectionTitle>
          <Text style={styles.body}>{record.notes}</Text>
        </Card>
      ) : null}

      <Card padded style={styles.cardSpacing}>
        <SectionTitle>{t("Observation")}</SectionTitle>
        {facts
          .filter((f) => f.value)
          .map((f) => (
            <View key={f.label} style={styles.factRow}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue}>{f.value}</Text>
            </View>
          ))}
        {record.latitude != null && record.longitude != null ? (
          <View style={[styles.factRow, styles.factRowLast]}>
            <Text style={styles.factLabel}>{t("Coordinates")}</Text>
            <Text style={[styles.factValue, styles.mono]}>
              {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
            </Text>
          </View>
        ) : null}
      </Card>

      {photos.length > 0 ? (
        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("Photos")}</SectionTitle>
          <View style={styles.photoRow}>
            {photos.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.photo} />
            ))}
          </View>
        </Card>
      ) : null}

      {record.latitude != null && record.longitude != null ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            title={t("Open location in OpenStreetMap")}
            variant="secondary"
            onPress={() =>
              Linking.openURL(openInOpenStreetMap(record.latitude as number, record.longitude as number))
            }
          />
        </View>
      ) : null}

      <Card padded style={styles.cardSpacing}>
        <SectionTitle>{t("Review")}</SectionTitle>
        {record.status === "pending" ? (
          <View style={styles.reviewText}>
            <Text style={styles.muted}>{t("Awaiting review by a supervisor.")}</Text>
            {canDelete ? (
              <Text style={styles.muted}>
                {t("You can still delete this record yourself until it is reviewed.")}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.body}>
              {record.status === "approved" ? t("Approved") : t("Rejected")}
              {record.reviewed_at
                ? t(" on {date}.", { date: formatDateTime(record.reviewed_at) })
                : "."}
            </Text>
            {record.supervisor_feedback ? (
              <Text style={styles.feedback}>
                {t("Comment: {comment}", { comment: record.supervisor_feedback })}
              </Text>
            ) : null}
          </>
        )}
      </Card>

      {record.type === "hazard" && record.status === "approved" ? (
        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("Work")}</SectionTitle>

          {/* Who has the job, how urgent it is and when it is due. */}
          {record.assigned_to ? (
            <View style={styles.assignment}>
              <Text style={styles.body}>
                {t("Assigned to {name}", {
                  name: record.assignee?.full_name ?? t("a field worker"),
                })}
              </Text>
              <View style={styles.assignmentPills}>
                {record.priority ? (
                  <Pill
                    label={t(PRIORITY_LABELS[record.priority])}
                    color={PRIORITY_COLORS[record.priority].fg}
                    background={PRIORITY_COLORS[record.priority].bg}
                  />
                ) : null}
                {record.due_on ? (
                  <Pill
                    label={
                      isOverdue(record)
                        ? t("{count}d overdue", {
                            count: Math.abs(daysUntilDue(record.due_on) ?? 0),
                          })
                        : t("Due {date}", { date: formatDueDate(record.due_on) })
                    }
                    color={isOverdue(record) ? colors.rejectedInk : colors.muted}
                    background={isOverdue(record) ? colors.rejectedSoft : colors.panel}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {record.reopen_reason && !record.completed_at ? (
            <Text style={styles.feedback}>
              {t("Sent back: {reason}", { reason: record.reopen_reason })}
            </Text>
          ) : null}

          {isCompleted ? (
            <View style={styles.reviewText}>
              <Text style={styles.body}>
                {record.closed_at
                  ? t("Closed by {name} on {date}.", {
                      name: record.closer?.full_name ?? t("a supervisor"),
                      date: formatDateTime(record.closed_at),
                    })
                  : t("Fixed by {name} on {date}.", {
                      name:
                        record.completer?.full_name ??
                        record.submitter?.full_name ??
                        t("a field worker"),
                      date: formatDateTime(record.completed_at),
                    })}
              </Text>
              {record.closed_at ? null : (
                <Text style={styles.muted}>
                  {t("Waiting for a supervisor to verify the fix.")}
                </Text>
              )}
              {record.completion_note ? (
                <Text style={styles.feedback}>{record.completion_note}</Text>
              ) : null}
              {record.close_note ? (
                <Text style={styles.feedback}>{record.close_note}</Text>
              ) : null}
              {completionPhotos.length > 0 ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={styles.factLabel}>{t("After photos")}</Text>
                  <View style={styles.photoRow}>
                    {completionPhotos.map((uri) => (
                      <Image key={uri} source={{ uri }} style={styles.photo} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <>
              <Text style={styles.muted}>
                {holdsJob
                  ? t("The report is approved. Do the work, then mark the job as done.")
                  : t("Waiting for the worker to finish the job.")}
              </Text>
              {holdsJob ? (
                <Button
                  title={t("Finish job")}
                  onPress={() => navigation.navigate("CompleteJob", { id: record.id })}
                  style={{ marginTop: spacing.md }}
                />
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      {canDelete ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            title={deleting ? t("Deleting...") : t("Delete this record")}
            variant="danger"
            onPress={confirmDelete}
            loading={deleting}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.page,
    padding: spacing.xl,
  },
  rowLeft: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" },
  title: { ...type.title, fontSize: 22, marginTop: spacing.md },
  meta: { ...type.subhead, marginTop: 3 },
  cardSpacing: { marginTop: spacing.lg },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  factRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  factLabel: { fontSize: 13, color: colors.muted },
  factValue: { fontSize: 15, color: colors.ink, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  mono: { fontVariant: ["tabular-nums"] },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 104, height: 104, borderRadius: radius.sm, backgroundColor: colors.line },
  feedback: {
    fontSize: 14,
    color: colors.ink,
    marginTop: spacing.md,
    lineHeight: 20,
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  reviewText: { gap: 6 },
  assignment: { gap: 6, marginBottom: spacing.sm },
  assignmentPills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
