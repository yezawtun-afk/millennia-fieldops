import React, { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { deleteRecord, fetchMyRecords } from "../lib/api";
import { listOutbox, removeOutbox } from "../lib/sqlite";
import { deletePhoto } from "../lib/photos";
import { syncOutbox } from "../lib/sync";
import { Banner, Button, Card, ListRow, Pill, SectionTitle } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import { STATUS_LABELS, formatDate } from "../lib/format";
import type { FieldRecord, OutboxRow } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Records">;

function statusPill(status: FieldRecord["status"]) {
  const palette =
    status === "pending"
      ? { fg: colors.pendingInk, bg: colors.pendingSoft }
      : status === "approved"
        ? { fg: colors.approvedInk, bg: colors.approvedSoft }
        : { fg: colors.rejectedInk, bg: colors.rejectedSoft };
  return <Pill label={STATUS_LABELS[status]} color={palette.fg} background={palette.bg} />;
}

export function MyRecordsScreen({ navigation }: Props) {
  const { profile, session } = useAuth();
  const userId = session?.user.id ?? profile?.id ?? null;
  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const drafts = outbox.filter((row) => row.status === "draft");
  const queued = outbox.filter((row) => row.status !== "draft");

  const load = useCallback(async () => {
    setOutbox(await listOutbox());
    if (!userId) return;
    try {
      setRecords(await fetchMyRecords(userId));
    } catch {
      // Offline: keep what is already on screen.
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function runSync() {
    if (!userId) return;
    setSyncing(true);
    const result = await syncOutbox(userId);
    setSyncing(false);
    setMessage(
      result.uploaded > 0
        ? `Uploaded ${result.uploaded} record${result.uploaded === 1 ? "" : "s"}.`
        : result.failed > 0
          ? `${result.failed} record${result.failed === 1 ? "" : "s"} still waiting. Check the connection.`
          : "Nothing to upload."
    );
    await load();
  }

  // A discarded draft never reached the server, so its local photos go too.
  async function discard(row: OutboxRow) {
    await removeOutbox(row.localId);
    for (const uri of row.payload.photos) {
      await deletePhoto(uri);
    }
    await load();
  }

  function confirmDeleteOutbox(row: OutboxRow, kind: "draft" | "queued") {
    Alert.alert(
      kind === "draft" ? "Delete draft" : "Cancel upload",
      kind === "draft"
        ? `Discard the draft "${row.payload.title}" and its photos?`
        : `Remove "${row.payload.title}" from the upload queue? It has not reached the server yet.`,
      [
        { text: "Keep", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void discard(row) },
      ]
    );
  }

  // A record that already reached the server can still be taken back while it is
  // pending. The database enforces the same rule, so a reviewed record is safe.
  function confirmDeleteRecord(record: FieldRecord) {
    Alert.alert(
      "Delete record",
      `Delete "${record.title}"? This cannot be undone. The record and its photos are removed for everyone.`,
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>My records</Text>
        <Text style={styles.subhead}>
          {records.length} submitted · {queued.length + drafts.length} on this phone
        </Text>
      </View>

      {message ? <Banner kind="info">{message}</Banner> : null}

      {drafts.length > 0 ? (
        <>
          <SectionTitle>Drafts</SectionTitle>
          <Card>
            {drafts.map((row, index) => (
              <ListRow
                key={row.localId}
                title={row.payload.title}
                meta={`Not finished · started ${formatDate(row.createdAt)}`}
                last={index === drafts.length - 1}
                onPress={() => navigation.navigate("New", { draftId: row.localId })}
                right={
                  <Pressable
                    accessibilityLabel={`Delete draft ${row.payload.title}`}
                    hitSlop={8}
                    onPress={() => confirmDeleteOutbox(row, "draft")}
                    style={styles.trash}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.muted} />
                  </Pressable>
                }
              />
            ))}
          </Card>
          <View style={{ height: spacing.xl }} />
        </>
      ) : null}

      {queued.length > 0 ? (
        <>
          <SectionTitle>Waiting to upload</SectionTitle>
          <Card>
            {queued.map((row, index) => (
              <ListRow
                key={row.localId}
                title={row.payload.title}
                meta={
                  row.status === "error" && row.error
                    ? row.error
                    : `Queued · ${formatDate(row.payload.observed_date)}`
                }
                last={index === queued.length - 1}
                right={
                  <View style={styles.rowRight}>
                    <Pill
                      label={row.status === "error" ? "Failed" : "Queued"}
                      color={row.status === "error" ? colors.rejectedInk : colors.pendingInk}
                      background={row.status === "error" ? colors.rejectedSoft : colors.pendingSoft}
                    />
                    <Pressable
                      accessibilityLabel={`Remove ${row.payload.title} from the queue`}
                      hitSlop={8}
                      onPress={() => confirmDeleteOutbox(row, "queued")}
                      style={styles.trash}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.muted} />
                    </Pressable>
                  </View>
                }
              />
            ))}
          </Card>
          <Button
            title={syncing ? "Syncing" : "Sync now"}
            variant="secondary"
            onPress={runSync}
            loading={syncing}
            style={{ marginTop: spacing.md }}
          />
          <View style={{ height: spacing.xl }} />
        </>
      ) : null}

      <SectionTitle>Submitted</SectionTitle>
      {records.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No records submitted yet</Text>
            <Text style={styles.emptyHint}>Records you capture appear here once they upload.</Text>
          </View>
        </Card>
      ) : (
        <Card>
          {records.map((record, index) => (
            <ListRow
              key={record.id}
              title={record.title}
              meta={`${record.zone?.name ?? "No zone"} · ${formatDate(record.observed_date)}`}
              last={index === records.length - 1}
              onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
              right={
                <View style={styles.rowRight}>
                  {statusPill(record.status)}
                  {record.status === "pending" ? (
                    <Pressable
                      accessibilityLabel={`Delete ${record.title}`}
                      hitSlop={8}
                      onPress={() => confirmDeleteRecord(record)}
                      style={styles.trash}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
              }
            />
          ))}
        </Card>
      )}

      {records.some((record) => record.supervisor_feedback) ? (
        <Text style={styles.footnote}>
          A supervisor left a comment on a record. Open it to read the note.
        </Text>
      ) : null}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.lg },
  title: { ...type.title },
  subhead: { ...type.subhead, marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trash: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { paddingVertical: spacing.lg, alignItems: "center", gap: 2 },
  emptyTitle: { fontSize: 15, fontWeight: "500", color: colors.ink },
  emptyHint: { ...type.caption, textAlign: "center" },
  footnote: { ...type.caption, marginTop: spacing.md, paddingHorizontal: spacing.xs },
});
