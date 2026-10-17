import React, { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { deleteRecord, fetchMyRecords } from "../lib/api";
import { listOutbox, removeOutbox } from "../lib/sqlite";
import { syncOutbox } from "../lib/sync";
import { Banner, Button, Card, Pill, SectionTitle } from "../components/ui";
import { colors } from "../theme";
import { STATUS_COLORS, STATUS_LABELS, TYPE_COLORS, TYPE_LABELS, formatDate, SEVERITY_COLORS } from "../lib/format";
import type { FieldRecord, OutboxRow } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Records">;

export function MyRecordsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const drafts = outbox.filter((row) => row.status === "draft");
  const queued = outbox.filter((row) => row.status !== "draft");

  const load = useCallback(async () => {
    setOutbox(await listOutbox());
    if (profile) {
      try {
        setRecords(await fetchMyRecords(profile.id));
      } catch {
        // offline - keep previous
      }
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function runSync() {
    if (!profile) return;
    setSyncing(true);
    const result = await syncOutbox(profile.id);
    setSyncing(false);
    setMessage(
      result.uploaded > 0
        ? `Uploaded ${result.uploaded} record(s).`
        : result.failed > 0
          ? `${result.failed} record(s) still waiting - check your connection.`
          : "Nothing to upload."
    );
    await load();
  }

  // Drafts are unfinished, so they are never uploaded until they are completed.
  // Queued rows have not reached the server yet either, so both can simply be
  // removed from the local outbox.
  function confirmDeleteOutbox(row: OutboxRow, kind: "draft" | "queued") {
    Alert.alert(
      kind === "draft" ? "Delete draft" : "Cancel upload",
      kind === "draft"
        ? `Discard the draft "${row.payload.title}"?`
        : `Remove "${row.payload.title}" from the upload queue? It has not reached the server yet.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeOutbox(row.localId);
            await load();
          },
        },
      ]
    );
  }

  // A record that already reached the server can still be taken back while it is
  // pending. The database enforces the same rule, so a reviewed record is safe.
  function confirmDeleteRecord(record: FieldRecord) {
    Alert.alert(
      "Delete record",
      `Delete "${record.title}"? This cannot be undone - the record and its photos are removed for everyone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecord(record.id, record.photos ?? []);
              await load();
            } catch {
              Alert.alert(
                "Could not delete",
                "Check your connection. Only your own records that are still pending can be deleted."
              );
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>My records</Text>

      {message ? <Banner kind="info">{message}</Banner> : null}

      {drafts.length > 0 ? (
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>Drafts ({drafts.length})</SectionTitle>
          {drafts.map((row) => (
            <View key={row.localId} style={styles.queuedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.queuedTitle}>{row.payload.title}</Text>
                <Text style={styles.queuedMeta}>
                  {TYPE_LABELS[row.payload.type]} - started {formatDate(row.createdAt)}
                </Text>
                <View style={styles.draftButtons}>
                  <Button
                    title="Continue"
                    variant="secondary"
                    style={styles.draftButton}
                    onPress={() => navigation.navigate("New", { draftId: row.localId })}
                  />
                  <View style={{ width: 8 }} />
                  <Button
                    title="Delete"
                    variant="danger"
                    style={styles.draftButton}
                    onPress={() => confirmDeleteOutbox(row, "draft")}
                  />
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {queued.length > 0 ? (
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>Pending upload ({queued.length})</SectionTitle>
          {queued.map((row) => (
            <View key={row.localId} style={styles.queuedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.queuedTitle}>{row.payload.title}</Text>
                <Text style={styles.queuedMeta}>
                  {TYPE_LABELS[row.payload.type]} - {formatDate(row.payload.observed_date)}
                </Text>
                {row.status === "error" && row.error ? (
                  <>
                    <Text style={styles.queuedError}>{row.error}</Text>
                    <View style={{ height: 8 }} />
                    <Button
                      title="Retry now"
                      variant="secondary"
                      onPress={runSync}
                      loading={syncing}
                    />
                  </>
                ) : null}
                <View style={{ height: 8 }} />
                <Button
                  title="Delete"
                  variant="danger"
                  onPress={() => confirmDeleteOutbox(row, "queued")}
                />
              </View>
              <Pill
                label={row.status === "error" ? "Upload failed" : "Pending upload"}
                color={colors.pending}
                background={colors.pendingSoft}
              />
            </View>
          ))}
          <View style={{ height: 10 }} />
          <Button title={syncing ? "Syncing..." : "Sync now"} onPress={runSync} loading={syncing} />
        </Card>
      ) : null}

      {records.length === 0 ? (
        <Card>
          <Text style={styles.muted}>You have not submitted any records yet.</Text>
        </Card>
      ) : (
        records.map((record) => (
          <Card key={record.id} style={{ marginBottom: 10 }}>
            <View style={styles.rowBetween}>
              <View style={styles.rowLeft}>
                <Pill
                  label={TYPE_LABELS[record.type]}
                  color={TYPE_COLORS[record.type].fg}
                  background={TYPE_COLORS[record.type].bg}
                />
                {record.type === "hazard" && record.severity ? (
                  <Pill label={record.severity} color="#FFFFFF" background={SEVERITY_COLORS[record.severity]} />
                ) : null}
              </View>
              <Pill
                label={STATUS_LABELS[record.status]}
                color={STATUS_COLORS[record.status].fg}
                background={STATUS_COLORS[record.status].bg}
              />
            </View>
            <Text style={styles.recordTitle}>{record.title}</Text>
            <Text style={styles.recordMeta}>
              {record.zone?.name ?? "No zone"} - {formatDate(record.observed_date)}
            </Text>
            {record.supervisor_feedback ? (
              <Text style={styles.feedback}>Supervisor: {record.supervisor_feedback}</Text>
            ) : null}
            <View style={styles.cardButtons}>
              <Button
                title="View details"
                variant="secondary"
                style={styles.cardButton}
                onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
              />
              {record.status === "pending" ? (
                <>
                  <View style={{ width: 8 }} />
                  <Button
                    title="Delete"
                    variant="danger"
                    style={styles.cardButton}
                    onPress={() => confirmDeleteRecord(record)}
                  />
                </>
              ) : null}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 20, fontWeight: "800", color: colors.ink, marginBottom: 14 },
  queuedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  queuedTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  queuedMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  queuedError: { fontSize: 12, color: colors.rejected, marginTop: 2 },
  draftButtons: { flexDirection: "row", marginTop: 10 },
  draftButton: { flex: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLeft: { flexDirection: "row", gap: 6, alignItems: "center" },
  recordTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, marginTop: 8 },
  recordMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  feedback: { fontSize: 13, color: colors.ink, marginTop: 8, fontStyle: "italic" },
  cardButtons: { flexDirection: "row", marginTop: 10 },
  cardButton: { flex: 1 },
  muted: { fontSize: 13, color: colors.muted },
});
