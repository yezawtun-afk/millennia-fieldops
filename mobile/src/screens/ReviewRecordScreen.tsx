// One record, decided from the phone: read the observation, look at the
// photos, leave a comment, approve or reject. The database trigger notifies the
// field worker, so the app does not send a separate message.
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchRecord, reviewRecord, signPhotoUrls } from "../lib/api";
import { openInOpenStreetMap } from "../lib/location";
import { useI18n } from "../i18n";
import { Banner, Button, Card, Input, Pill, SectionTitle } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import {
  SEVERITY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  formatDate,
  formatDateTime,
} from "../lib/format";
import type { FieldRecord } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ReviewRecord">;

export function ReviewRecordScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { t } = useI18n();
  const [record, setRecord] = useState<FieldRecord | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      (async () => {
        const data = await fetchRecord(id);
        if (!active) return;
        setRecord(data);
        setFeedback(data?.supervisor_feedback ?? "");
        if (data && data.photos?.length) {
          setPhotos(await signPhotoUrls(data.photos));
        }
        setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [id])
  );

  function decide(decision: "approved" | "rejected") {
    if (!record) return;
    if (decision === "rejected" && !feedback.trim()) {
      Alert.alert(
        t("A comment is needed"),
        t("Explain what needs to change before this record can be rejected.")
      );
      return;
    }

    Alert.alert(
      decision === "approved" ? t("Approve this record?") : t("Reject this record?"),
      decision === "approved"
        ? t("The field worker will be told it was approved.")
        : t("The field worker will be told it was rejected, with your comment."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: decision === "approved" ? t("Approve") : t("Reject"),
          style: decision === "rejected" ? "destructive" : "default",
          onPress: () => void submit(decision),
        },
      ]
    );
  }

  async function submit(decision: "approved" | "rejected") {
    if (!record) return;
    setBusy(decision);
    setError(null);
    try {
      await reviewRecord(record.id, decision, feedback);
      navigation.goBack();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("The decision could not be saved. Check your connection and try again.")
      );
    } finally {
      setBusy(null);
    }
  }

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
        <Text style={styles.muted}>{t("This record could not be loaded. You may be offline.")}</Text>
      </View>
    );
  }

  const facts: { label: string; value: string | null }[] =
    record.type === "flora"
      ? [
          { label: t("Species"), value: record.species_name },
          { label: t("Growth stage"), value: record.growth_stage ? t(record.growth_stage) : null },
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

  const alreadyReviewed = record.status !== "pending";

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
        {t("By {name}", { name: record.submitter?.full_name ?? t("Unknown submitter") })} ·{" "}
        {record.zone?.name ?? t("No zone")} · {t("observed {date}", { date: formatDate(record.observed_date) })}
      </Text>

      {error ? <Banner kind="error">{error}</Banner> : null}

      {record.notes ? (
        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("Notes")}</SectionTitle>
          <Text style={styles.body}>{record.notes}</Text>
        </Card>
      ) : null}

      <Card padded style={styles.cardSpacing}>
        <SectionTitle>{t("Observation")}</SectionTitle>
        {facts
          .filter((fact) => fact.value)
          .map((fact) => (
            <View key={fact.label} style={styles.factRow}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>{fact.value}</Text>
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

      {alreadyReviewed ? (
        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("Decision")}</SectionTitle>
          <Text style={styles.body}>
            {record.status === "approved" ? t("Approved") : t("Rejected")}
            {record.reviewed_at ? t(" on {date}.", { date: formatDateTime(record.reviewed_at) }) : "."}
          </Text>
          {record.supervisor_feedback ? (
            <Text style={styles.feedback}>
              {t("Comment: {comment}", { comment: record.supervisor_feedback })}
            </Text>
          ) : null}
        </Card>
      ) : (
        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("Decision")}</SectionTitle>
          <Text style={styles.muted}>
            {t("A comment helps the field worker. It is required when you reject a record.")}
          </Text>
          <Input
            value={feedback}
            onChangeText={setFeedback}
            placeholder={t("Add a comment for the field worker")}
            multiline
            style={{ marginTop: spacing.sm }}
          />
          <Button
            title={busy === "approved" ? t("Approving...") : t("Approve")}
            onPress={() => decide("approved")}
            loading={busy === "approved"}
            disabled={busy !== null}
            style={{ marginTop: spacing.md }}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title={busy === "rejected" ? t("Rejecting...") : t("Reject")}
            variant="danger"
            onPress={() => decide("rejected")}
            loading={busy === "rejected"}
            disabled={busy !== null}
          />
        </Card>
      )}

      <View style={{ height: spacing.xxl }} />
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
  meta: { ...type.subhead, marginTop: 3, marginBottom: spacing.md },
  cardSpacing: { marginTop: spacing.lg },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19 },
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
});
