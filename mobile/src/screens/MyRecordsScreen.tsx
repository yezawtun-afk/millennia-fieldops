import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { deleteRecord, fetchMyRecords } from "../lib/api";
import { listOutbox, removeOutbox } from "../lib/sqlite";
import { deletePhoto } from "../lib/photos";
import { useI18n } from "../i18n";
import {
  Banner,
  Button,
  Card,
  ChipGroup,
  ListRow,
  Pill,
  SearchInput,
  SectionTitle,
} from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import { STATUS_LABELS, formatDate } from "../lib/format";
import type { FieldRecord, OutboxRow } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Records">;

// The filters use short labels that fit a chip; the stored values stay as the
// database spells them.
const STATUS_FILTERS = ["all", "pending", "approved", "rejected"] as const;
const TYPE_FILTERS = ["all", "flora", "soil_water", "hazard"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type TypeFilter = (typeof TYPE_FILTERS)[number];

const STATUS_CHIP_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const TYPE_CHIP_LABELS: Record<TypeFilter, string> = {
  all: "All types",
  flora: "Flora",
  soil_water: "Soil & water",
  hazard: "Hazard",
};

// Case-insensitive "contains" across any of the given fields.
function matchesQuery(
  needle: string,
  ...parts: (string | null | undefined)[]
): boolean {
  if (!needle) return true;
  return parts.some((part) => part?.toLowerCase().includes(needle));
}

export function MyRecordsScreen({ navigation }: Props) {
  const { profile, session } = useAuth();
  const { t } = useI18n();
  const { syncing, syncNow } = useSync();
  const userId = session?.user.id ?? profile?.id ?? null;
  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const needle = query.trim().toLowerCase();
  const filtersActive =
    needle.length > 0 || statusFilter !== "all" || typeFilter !== "all";

  // A review status only exists after upload, so a status filter hides the
  // local drafts and queue instead of pretending a draft is "approved".
  const showLocal = statusFilter === "all";

  const localRows = useMemo(
    () =>
      outbox.filter(
        (row) =>
          (typeFilter === "all" || row.payload.type === typeFilter) &&
          matchesQuery(
            needle,
            row.payload.title,
            row.payload.species_name,
            row.payload.notes
          )
      ),
    [outbox, typeFilter, needle]
  );

  const submitted = useMemo(
    () =>
      records.filter(
        (record) =>
          (statusFilter === "all" || record.status === statusFilter) &&
          (typeFilter === "all" || record.type === typeFilter) &&
          matchesQuery(needle, record.title, record.species_name, record.notes)
      ),
    [records, statusFilter, typeFilter, needle]
  );

  const drafts = showLocal ? localRows.filter((row) => row.status === "draft") : [];
  const queued = showLocal ? localRows.filter((row) => row.status !== "draft") : [];

  const anyMatch = drafts.length + queued.length + submitted.length > 0;
  // What "Showing X of Y" counts. With a status filter the local rows are
  // deliberately out of scope, so they should not inflate the total either.
  const visibleTotal = showLocal
    ? records.length + outbox.length
    : records.length;
  const visibleShown = drafts.length + queued.length + submitted.length;

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    Keyboard.dismiss();
  }

  function statusPill(status: FieldRecord["status"]) {
    const palette =
      status === "pending"
        ? { fg: colors.pendingInk, bg: colors.pendingSoft }
        : status === "approved"
          ? { fg: colors.approvedInk, bg: colors.approvedSoft }
          : { fg: colors.rejectedInk, bg: colors.rejectedSoft };
    return <Pill label={t(STATUS_LABELS[status])} color={palette.fg} background={palette.bg} />;
  }

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
    const result = await syncNow();
    setMessage(
      !result
        ? t("Could not start the upload. Check your connection.")
        : result.uploaded > 0
          ? t("Uploaded {count} records.", { count: result.uploaded })
          : result.failed > 0
            ? t("{count} records still waiting. Check the connection.", { count: result.failed })
            : t("Nothing to upload.")
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
      kind === "draft" ? t("Delete draft") : t("Cancel upload"),
      kind === "draft"
        ? t('Discard the draft "{title}" and its photos?', { title: row.payload.title })
        : t('Remove "{title}" from the upload queue? It has not reached the server yet.', {
            title: row.payload.title,
          }),
      [
        { text: t("Keep"), style: "cancel" },
        { text: t("Delete"), style: "destructive", onPress: () => void discard(row) },
      ]
    );
  }

  // A record that already reached the server can still be taken back while it is
  // pending. The database enforces the same rule, so a reviewed record is safe.
  function confirmDeleteRecord(record: FieldRecord) {
    Alert.alert(
      t("Delete record"),
      t('Delete "{title}"? This cannot be undone. The record and its photos are removed for everyone.', {
        title: record.title,
      }),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecord(record.id, record.photos ?? []);
              await load();
            } catch {
              Alert.alert(
                t("Could not delete"),
                t(
                  "Check your connection. Only your own records that are still pending can be deleted."
                )
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
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t("My records")}</Text>
        <Text style={styles.subhead}>
          {t("{submitted} submitted · {local} on this phone", {
            submitted: records.length,
            local: outbox.length,
          })}
        </Text>
      </View>

      {/* Nothing to search before the first record exists. */}
      {records.length > 0 || outbox.length > 0 ? (
        <View style={styles.filters}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("Search title, species, notes")}
            accessibilityLabel={t("Search records")}
          />
          <ChipGroup
            options={[...STATUS_FILTERS]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            labelFor={(value) => t(STATUS_CHIP_LABELS[value as StatusFilter])}
          />
          <ChipGroup
            options={[...TYPE_FILTERS]}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as TypeFilter)}
            labelFor={(value) => t(TYPE_CHIP_LABELS[value as TypeFilter])}
          />
          {filtersActive ? (
            <View style={styles.filterFooter}>
              <Text style={styles.filterCount}>
                {t("Showing {shown} of {total}", {
                  shown: visibleShown,
                  total: visibleTotal,
                })}
              </Text>
              <Pressable
                onPress={clearFilters}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("Clear filters")}
                style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={13} color={colors.muted} />
                <Text style={styles.clearText}>{t("Clear filters")}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {message ? <Banner kind="info">{message}</Banner> : null}

      {filtersActive && !anyMatch ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="search" size={22} color={colors.muted} />
            <Text style={styles.emptyTitle}>{t("No records match")}</Text>
            <Text style={styles.emptyHint}>
              {t("Try a different word or clear the filters.")}
            </Text>
            <Button
              title={t("Clear filters")}
              variant="secondary"
              onPress={clearFilters}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </Card>
      ) : (
        <>
          {drafts.length > 0 ? (
            <>
              <SectionTitle>{t("Drafts")}</SectionTitle>
              <Card>
                {drafts.map((row, index) => (
                  <ListRow
                    key={row.localId}
                    title={row.payload.title}
                    meta={t("Not finished · started {date}", {
                      date: formatDate(row.createdAt),
                    })}
                    last={index === drafts.length - 1}
                    onPress={() => navigation.navigate("New", { draftId: row.localId })}
                    right={
                      <Pressable
                        accessibilityLabel={t("Delete draft {title}", {
                          title: row.payload.title,
                        })}
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
              <SectionTitle>{t("Waiting to upload")}</SectionTitle>
              <Card>
                {queued.map((row, index) => (
                  <ListRow
                    key={row.localId}
                    title={row.payload.title}
                    meta={
                      row.status === "error" && row.error
                        ? row.error
                        : t("Queued · {date}", {
                            date: formatDate(row.payload.observed_date),
                          })
                    }
                    last={index === queued.length - 1}
                    right={
                      <View style={styles.rowRight}>
                        <Pill
                          label={row.status === "error" ? t("Failed") : t("Queued")}
                          color={
                            row.status === "error" ? colors.rejectedInk : colors.pendingInk
                          }
                          background={
                            row.status === "error" ? colors.rejectedSoft : colors.pendingSoft
                          }
                        />
                        <Pressable
                          accessibilityLabel={t("Remove {title} from the queue", {
                            title: row.payload.title,
                          })}
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
                title={syncing ? t("Syncing") : t("Sync now")}
                variant="secondary"
                onPress={runSync}
                loading={syncing}
                style={{ marginTop: spacing.md }}
              />
              <View style={{ height: spacing.xl }} />
            </>
          ) : null}

          {submitted.length > 0 || !filtersActive ? (
            <>
              <SectionTitle>{t("Submitted")}</SectionTitle>
              {submitted.length === 0 ? (
                <Card>
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>{t("No records submitted yet")}</Text>
                    <Text style={styles.emptyHint}>
                      {t("Records you capture appear here once they upload.")}
                    </Text>
                  </View>
                </Card>
              ) : (
                <Card>
                  {submitted.map((record, index) => (
                    <ListRow
                      key={record.id}
                      title={record.title}
                      meta={`${record.zone?.name ?? t("No zone")} · ${formatDate(
                        record.observed_date
                      )}`}
                      last={index === submitted.length - 1}
                      onPress={() =>
                        navigation.navigate("RecordDetails", { id: record.id })
                      }
                      right={
                        <View style={styles.rowRight}>
                          {statusPill(record.status)}
                          {record.status === "pending" ? (
                            <Pressable
                              accessibilityLabel={t("Delete {title}", {
                                title: record.title,
                              })}
                              hitSlop={8}
                              onPress={() => confirmDeleteRecord(record)}
                              style={styles.trash}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={17}
                                color={colors.muted}
                              />
                            </Pressable>
                          ) : null}
                        </View>
                      }
                    />
                  ))}
                </Card>
              )}
            </>
          ) : null}
        </>
      )}

      {submitted.some((record) => record.supervisor_feedback) ? (
        <Text style={styles.footnote}>
          {t("A supervisor left a comment on a record. Open it to read the note.")}
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
  filters: { gap: spacing.sm, marginBottom: spacing.lg },
  filterFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  filterCount: { ...type.caption },
  clear: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  clearText: { fontSize: 12, fontWeight: "600", color: colors.muted },
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
