import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { deleteRecord, fetchRecord, signPhotoUrls } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { openInOpenStreetMap } from "../lib/location";
import { Button, Card, Pill, SectionTitle } from "../components/ui";
import { colors, radius } from "../theme";
import { STATUS_COLORS, STATUS_LABELS, TYPE_COLORS, TYPE_LABELS, formatDate, formatDateTime, SEVERITY_COLORS } from "../lib/format";
import type { FieldRecord } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "RecordDetails">;

export function RecordDetailsScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { profile } = useAuth();
  const [record, setRecord] = useState<FieldRecord | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
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
        <Text style={styles.muted}>This record could not be loaded. You may be offline.</Text>
      </View>
    );
  }

  const isOwnRecord = Boolean(profile && record.submitted_by === profile.id);
  // Your own record, not reviewed yet: you may take it back.
  const canDelete = isOwnRecord && record.status === "pending";

  function confirmDelete() {
    if (!record) return;
    Alert.alert(
      "Delete record",
      `Delete "${record.title}"? This cannot be undone - the record and its photos are removed for everyone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteRecord(record.id, record.photos ?? []);
              navigation.goBack();
            } catch {
              Alert.alert(
                "Could not delete",
                "You need a connection to delete an uploaded record, and only records that are still pending can be removed."
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
          { label: "Species", value: record.species_name },
          { label: "Growth stage", value: record.growth_stage },
          { label: "Health condition", value: record.health_condition },
          { label: "Estimated count", value: record.estimated_count != null ? String(record.estimated_count) : null },
        ]
      : record.type === "hazard"
        ? [
            { label: "Hazard type", value: record.hazard_type },
            { label: "Severity", value: record.severity },
          ]
        : [
            { label: "Reading type", value: record.reading_type },
            { label: "Value", value: record.reading_value != null ? String(record.reading_value) : null },
            { label: "Unit", value: record.reading_unit },
          ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.rowLeft}>
        <Pill
          label={TYPE_LABELS[record.type]}
          color={TYPE_COLORS[record.type].fg}
          background={TYPE_COLORS[record.type].bg}
        />
        <Pill
          label={STATUS_LABELS[record.status]}
          color={STATUS_COLORS[record.status].fg}
          background={STATUS_COLORS[record.status].bg}
        />
        {record.type === "hazard" && record.severity ? (
          <Pill label={record.severity} color="#FFFFFF" background={SEVERITY_COLORS[record.severity]} />
        ) : null}
      </View>

      <Text style={styles.title}>{record.title}</Text>
      <Text style={styles.meta}>
        {record.zone?.name ?? "No zone"} - observed {formatDate(record.observed_date)}
      </Text>

      {record.notes ? (
        <Card style={{ marginTop: 14 }}>
          <SectionTitle>Notes</SectionTitle>
          <Text style={styles.body}>{record.notes}</Text>
        </Card>
      ) : null}

      <Card style={{ marginTop: 14 }}>
        <SectionTitle>Observation</SectionTitle>
        {facts
          .filter((f) => f.value)
          .map((f) => (
            <View key={f.label} style={styles.factRow}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue}>{f.value}</Text>
            </View>
          ))}
        {record.latitude != null && record.longitude != null ? (
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Coordinates</Text>
            <Text style={styles.factValue}>
              {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
            </Text>
          </View>
        ) : null}
      </Card>

      {photos.length > 0 ? (
        <Card style={{ marginTop: 14 }}>
          <SectionTitle>Photos</SectionTitle>
          <View style={styles.photoRow}>
            {photos.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.photo} />
            ))}
          </View>
        </Card>
      ) : null}

      {record.latitude != null && record.longitude != null ? (
        <View style={{ marginTop: 14 }}>
          <Button
            title="Open location in OpenStreetMap"
            variant="secondary"
            onPress={() =>
              Linking.openURL(openInOpenStreetMap(record.latitude as number, record.longitude as number))
            }
          />
        </View>
      ) : null}

      <Card style={{ marginTop: 14 }}>
        <SectionTitle>Review</SectionTitle>
        {record.status === "pending" ? (
          <View style={styles.reviewText}>
            <Text style={styles.muted}>Awaiting review by a supervisor.</Text>
            {canDelete ? (
              <Text style={styles.muted}>
                You can still delete this record yourself until it is reviewed.
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.body}>
              {record.status === "approved" ? "Approved" : "Rejected"}
              {record.reviewed_at ? ` on ${formatDateTime(record.reviewed_at)}` : ""}.
            </Text>
            {record.supervisor_feedback ? (
              <Text style={styles.feedback}>Comment: {record.supervisor_feedback}</Text>
            ) : null}
          </>
        )}
      </Card>

      {canDelete ? (
        <View style={{ marginTop: 14 }}>
          <Button
            title={deleting ? "Deleting..." : "Delete this record"}
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
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.page, padding: 24 },
  rowLeft: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 12 },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.muted },
  factRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  factLabel: { fontSize: 13, color: colors.muted },
  factValue: { fontSize: 14, color: colors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photo: { width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.line },
  feedback: { fontSize: 13, color: colors.ink, marginTop: 8, fontStyle: "italic" },
  reviewText: { gap: 6 },
});
