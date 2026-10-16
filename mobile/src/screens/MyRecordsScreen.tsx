import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { fetchMyRecords } from "../lib/api";
import { listOutbox } from "../lib/sqlite";
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>My records</Text>

      {message ? <Banner kind="info">{message}</Banner> : null}

      {outbox.length > 0 ? (
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>Pending upload ({outbox.length})</SectionTitle>
          {outbox.map((row) => (
            <View key={row.localId} style={styles.queuedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.queuedTitle}>{row.payload.title}</Text>
                <Text style={styles.queuedMeta}>
                  {TYPE_LABELS[row.payload.type]} - {formatDate(row.payload.observed_date)}
                </Text>
                {row.status === "error" && row.error ? (
                  <Text style={styles.queuedError}>{row.error}</Text>
                ) : null}
              </View>
              <Pill
                label={row.status === "error" ? "Needs retry" : "Pending upload"}
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
            <View style={{ height: 8 }} />
            <Button
              title="View details"
              variant="secondary"
              onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
            />
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
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLeft: { flexDirection: "row", gap: 6, alignItems: "center" },
  recordTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, marginTop: 8 },
  recordMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  feedback: { fontSize: 13, color: colors.ink, marginTop: 8, fontStyle: "italic" },
  muted: { fontSize: 13, color: colors.muted },
});
