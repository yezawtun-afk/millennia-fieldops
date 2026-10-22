// The supervisor queue: every record still waiting for a decision, oldest
// first. Tapping a row opens the decision screen. Only supervisors and
// administrators see this tab (RootNavigator hides it for field workers, and
// the database refuses the update for them anyway).
import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { fetchPendingRecords } from "../lib/api";
import { useI18n } from "../i18n";
import { Banner, Card, EmptyState, ListRow, Pill } from "../components/ui";
import { colors, spacing, type } from "../theme";
import { formatDate, TYPE_COLORS, TYPE_LABELS } from "../lib/format";
import type { FieldRecord } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"Review">;

export function ReviewScreen({ navigation }: Props) {
  const { t } = useI18n();
  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setRecords(await fetchPendingRecords());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t("Review queue")}</Text>
        <Text style={styles.subhead}>
          {records.length > 0
            ? t("{count} waiting for a decision. Oldest first.", { count: records.length })
            : t("Records waiting for a supervisor decision appear here.")}
        </Text>
      </View>

      {error ? (
        <Banner kind="error">
          {t("Could not load the review queue. Check your connection and pull down to retry.")}
        </Banner>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : records.length === 0 && !error ? (
        <EmptyState
          title={t("Nothing waiting for review")}
          hint={t("New submissions will appear here as soon as they reach the server.")}
        />
      ) : (
        <Card>
          {records.map((record, index) => (
            <ListRow
              key={record.id}
              title={record.title}
              meta={`${record.submitter?.full_name ?? t("Unknown submitter")} · ${
                record.zone?.name ?? t("No zone")
              } · ${formatDate(record.observed_date)}`}
              last={index === records.length - 1}
              onPress={() => navigation.navigate("ReviewRecord", { id: record.id })}
              icon={
                <View
                  style={[styles.typeIcon, { backgroundColor: TYPE_COLORS[record.type].bg }]}
                >
                  <Ionicons
                    name={
                      record.type === "flora"
                        ? "leaf-outline"
                        : record.type === "hazard"
                          ? "warning-outline"
                          : "water-outline"
                    }
                    size={17}
                    color={TYPE_COLORS[record.type].fg}
                  />
                </View>
              }
              right={
                <Pill
                  label={t(TYPE_LABELS[record.type])}
                  color={TYPE_COLORS[record.type].fg}
                  background={TYPE_COLORS[record.type].bg}
                />
              }
            />
          ))}
        </Card>
      )}

      <Text style={styles.footnote}>
        {t("Approve or reject a record on this phone. The field worker is notified straight away.")}
      </Text>
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
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: { ...type.caption, marginTop: spacing.md, paddingHorizontal: spacing.xs, lineHeight: 17 },
});
