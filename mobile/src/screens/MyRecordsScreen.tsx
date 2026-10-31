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
  ListRow,
  Pill,
  SearchInput,
  SectionTitle,
} from "../components/ui";
import {
  RecordFilterSheet,
  type CompletionFilter,
  type StatusFilter,
  type TypeFilter,
} from "../components/RecordFilterSheet";
import { radius, spacing, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  daysUntilDue,
  formatDate,
  formatDueDate,
  isOverdue,
} from "../lib/format";
import type { FieldRecord, OutboxRow } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Records">;

// Case-insensitive "contains" across any of the given fields.
function matchesQuery(
  needle: string,
  ...parts: (string | null | undefined)[]
): boolean {
  if (!needle) return true;
  return parts.some((part) => part?.toLowerCase().includes(needle));
}

// A job the worker still has to do: an approved hazard that is not fixed and is
// theirs to fix. The assignee holds it; when nobody was assigned, the reporter
// does. A hazard a supervisor gave to someone else is not this worker's problem
// even though they reported it.
function holdsJob(record: FieldRecord, userId: string | null): boolean {
  if (!userId) return false;
  if (record.type !== "hazard" || record.status !== "approved") return false;
  if (record.completed_at || record.closed_at) return false;
  return (record.assigned_to ?? record.submitted_by) === userId;
}

export function MyRecordsScreen({ navigation }: Props) {
  const { profile, session } = useAuth();
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);
  const { colors, tones } = useTheme();
  const { syncing, syncNow } = useSync();
  const userId = session?.user.id ?? profile?.id ?? null;
  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const needle = query.trim().toLowerCase();
  const filtersActive =
    needle.length > 0 ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    completionFilter !== "all";
  const activeFilterCount = [statusFilter, typeFilter, completionFilter].filter(
    (value) => value !== "all"
  ).length;

  // A review status only exists after upload, and a completion only exists once
  // a job is done, so either filter hides the local drafts and queue rather than
  // pretending a draft is "approved" or "complete".
  const showLocal = statusFilter === "all" && completionFilter === "all";

  // The type and search filters apply to every group below, so they are worked
  // out once.
  const base = useMemo(
    () =>
      records.filter(
        (record) =>
          (typeFilter === "all" || record.type === typeFilter) &&
          matchesQuery(needle, record.title, record.species_name, record.notes)
      ),
    [records, typeFilter, needle]
  );

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

  // "Incomplete" removes the finished jobs from Submitted; "Completed" keeps
  // only them. In both cases the review-status filter is ignored because the
  // sheet locks it to "All statuses".
  const submitted = useMemo(() => {
    if (completionFilter === "open") return [];
    return base.filter((record) => {
      if (holdsJob(record, userId)) return false;
      if (completionFilter === "done")
        return record.type === "hazard" && Boolean(record.completed_at);
      return statusFilter === "all" || record.status === statusFilter;
    });
  }, [base, completionFilter, statusFilter, userId]);

  // All and Approved include jobs that still need doing. Pending and Rejected
  // are about review decisions, so open jobs (which are always approved) would
  // be out of place there.
  const openJobs = useMemo(() => {
    if (completionFilter === "done") return [];
    if (
      completionFilter === "all" &&
      statusFilter !== "all" &&
      statusFilter !== "approved"
    ) {
      return [];
    }
    return base.filter((record) => holdsJob(record, userId));
  }, [base, completionFilter, statusFilter, userId]);

  // Work a supervisor handed over is listed separately: it is not the worker's
  // own report, so it reads better under its own heading.
  const assignedJobs = openJobs.filter((record) => record.assigned_to === userId);
  const ownJobs = openJobs.filter((record) => !record.assigned_to);

  // A job line carries the facts the worker needs before walking out there.
  function jobMeta(record: FieldRecord): string {
    const parts = [record.zone?.name ?? t("No zone")];
    if (record.priority) parts.push(t(PRIORITY_LABELS[record.priority]));
    if (record.due_on) {
      const days = daysUntilDue(record.due_on);
      parts.push(
        isOverdue(record)
          ? t("{count}d overdue", { count: Math.abs(days ?? 0) })
          : days === 0
            ? t("Due today")
            : days === 1
              ? t("Due tomorrow")
              : t("Due {date}", { date: formatDueDate(record.due_on) })
      );
    }
    return parts.join(" Â· ");
  }

  const drafts = showLocal ? localRows.filter((row) => row.status === "draft") : [];
  const queued = showLocal ? localRows.filter((row) => row.status !== "draft") : [];

  const anyMatch =
    drafts.length + queued.length + openJobs.length + submitted.length > 0;
  // What "Showing X of Y" counts. With a status or completion filter the local
  // rows are deliberately out of scope, so they should not inflate the total.
  const visibleTotal = useMemo(() => {
    const inTypeScope = records.filter(
      (record) => typeFilter === "all" || record.type === typeFilter
    );
    if (completionFilter === "open") return inTypeScope.filter((record) => holdsJob(record, userId)).length;
    if (completionFilter === "done")
      return inTypeScope.filter(
        (record) => record.type === "hazard" && Boolean(record.completed_at)
      ).length;
    if (!showLocal) return inTypeScope.length;
    const localInTypeScope = outbox.filter(
      (row) => typeFilter === "all" || row.payload.type === typeFilter
    );
    return inTypeScope.length + localInTypeScope.length;
  }, [records, outbox, typeFilter, completionFilter, showLocal, userId]);
  const visibleShown = drafts.length + queued.length + openJobs.length + submitted.length;

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setCompletionFilter("all");
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
          {t("{submitted} submitted Â· {local} on this phone", {
            submitted: records.length,
            local: outbox.length,
          })}
        </Text>
      </View>

      {/* Nothing to search before the first record exists. */}
      {records.length > 0 || outbox.length > 0 ? (
        <View style={styles.filters}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("Search title, species, notes")}
                accessibilityLabel={t("Search records")}
              />
            </View>
            <Pressable
              onPress={() => setFiltersOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("Filters")}
              style={({ pressed }) => [
                styles.filterButton,
                activeFilterCount > 0 ? styles.filterButtonActive : null,
                pressed ? { opacity: 0.7 } : null,
              ]}
            >
              <Ionicons
                name="options-outline"
                size={17}
                color={activeFilterCount > 0 ? colors.primaryDark : colors.ink}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  activeFilterCount > 0 ? styles.filterButtonTextActive : null,
                ]}
              >
                {t("Filters")}
              </Text>
              {activeFilterCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
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
            <Ionicons
              name={
                completionFilter === "done"
                  ? "checkmark-done-outline"
                  : completionFilter === "open"
                    ? "construct-outline"
                    : "search"
              }
              size={22}
              color={colors.muted}
            />
            <Text style={styles.emptyTitle}>
              {completionFilter === "open"
                ? t("No jobs to do")
                : completionFilter === "done"
                  ? t("No completed jobs yet")
                  : t("No records match")}
            </Text>
            <Text style={styles.emptyHint}>
              {completionFilter === "open"
                ? t("Approved hazards you still need to finish appear here.")
                : completionFilter === "done"
                  ? t("Finished jobs appear here with their notes and after photos.")
                  : t("Try a different word or clear the filters.")}
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
          {assignedJobs.length > 0 ? (
            <>
              <SectionTitle>{t("Assigned tasks")}</SectionTitle>
              <Card>
                {assignedJobs.map((record, index) => (
                  <ListRow
                    key={record.id}
                    title={record.title}
                    meta={jobMeta(record)}
                    right={
                      record.priority ? (
                        <Pill
                          label={t(PRIORITY_LABELS[record.priority])}
                          color={tones.priority[record.priority].fg}
                          background={tones.priority[record.priority].bg}
                        />
                      ) : undefined
                    }
                    last={index === assignedJobs.length - 1}
                    onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
                  />
                ))}
              </Card>
              <View style={{ height: spacing.xl }} />
            </>
          ) : null}

          {ownJobs.length > 0 ? (
            <>
              <SectionTitle>{t("To do")}</SectionTitle>
              <Card>
                {ownJobs.map((record, index) => (
                  <ListRow
                    key={record.id}
                    title={record.title}
                    meta={`${record.zone?.name ?? t("No zone")} Â· ${t("Approved")} ${formatDate(
                      record.reviewed_at ?? record.observed_date
                    )}`}
                    last={index === ownJobs.length - 1}
                    onPress={() => navigation.navigate("RecordDetails", { id: record.id })}
                  />
                ))}
              </Card>
              <View style={{ height: spacing.xl }} />
            </>
          ) : null}

          {drafts.length > 0 ? (
            <>
              <SectionTitle>{t("Drafts")}</SectionTitle>
              <Card>
                {drafts.map((row, index) => (
                  <ListRow
                    key={row.localId}
                    title={row.payload.title}
                    meta={t("Not finished Â· started {date}", {
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
                        style={({ pressed }) => [styles.trash, pressed && { opacity: 0.5, transform: [{ scale: 0.9 }] }]}
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
                        : t("Queued Â· {date}", {
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
                          style={({ pressed }) => [styles.trash, pressed && { opacity: 0.5, transform: [{ scale: 0.9 }] }]}
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

          {submitted.length > 0 || (!filtersActive && records.length === 0) ? (
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
                      meta={`${record.zone?.name ?? t("No zone")} Â· ${formatDate(
                        record.observed_date
                      )}`}
                      last={index === submitted.length - 1}
                      onPress={() =>
                        navigation.navigate("RecordDetails", { id: record.id })
                      }
                      right={
                        <View style={styles.rowRight}>
                          {record.completed_at ? (
                            <Pill
                              label={t("Completed")}
                              color={colors.approvedInk}
                              background={colors.approvedSoft}
                              icon={
                                <Ionicons
                                  name="checkmark-circle"
                                  size={12}
                                  color={colors.approvedInk}
                                />
                              }
                            />
                          ) : (
                            statusPill(record.status)
                          )}
                          {record.status === "pending" ? (
                            <Pressable
                              accessibilityLabel={t("Delete {title}", {
                                title: record.title,
                              })}
                              hitSlop={8}
                              onPress={() => confirmDeleteRecord(record)}
                              style={({ pressed }) => [styles.trash, pressed && { opacity: 0.5, transform: [{ scale: 0.9 }] }]}
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

      {records.some((record) => record.supervisor_feedback) ? (
        <Text style={styles.footnote}>
          {t("A supervisor left a comment on a record. Open it to read the note.")}
        </Text>
      ) : null}

      <View style={{ height: spacing.xxl }} />

      <RecordFilterSheet
        visible={filtersOpen}
        status={statusFilter}
        type={typeFilter}
        completion={completionFilter}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setStatusFilter(next.status);
          setTypeFilter(next.type);
          setCompletionFilter(next.completion);
          setFiltersOpen(false);
          Keyboard.dismiss();
        }}
      />
    </ScrollView>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.page },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    header: { paddingTop: spacing.sm, paddingBottom: spacing.lg },
    title: { ...type.title },
    subhead: { ...type.subhead, marginTop: 2 },
    filters: { gap: spacing.sm, marginBottom: spacing.lg },
    searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    searchBox: { flex: 1 },
    filterButton: {
      height: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.control,
      backgroundColor: colors.card,
    },
    filterButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    filterButtonText: { fontSize: 14, fontWeight: "500", color: colors.ink },
    filterButtonTextActive: { color: colors.primaryDark, fontWeight: "600" },
    filterBadge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    filterBadgeText: { fontSize: 11, fontWeight: "600", color: colors.onTint },
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
