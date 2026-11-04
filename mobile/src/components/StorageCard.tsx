// "On this phone": how much room the stored photos take, split into the ones a
// record still needs and the ones nothing points at, with one action that
// deletes only the second kind.
//
// The number is local and offline: it is a reading of the phone's own folder,
// not a server count.
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useI18n } from "../i18n";
import { Button, Card } from "./ui";
import {
  clearLeftoverPhotos,
  formatBytes,
  scanPhotoStorage,
  type StorageReport,
} from "../lib/storage";
import { subscribeSync } from "../lib/sync";
import { spacing, type ThemeScale } from "../theme";
import { useThemedStyles } from "../lib/useTheme";

export function StorageCard() {
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);

  const [report, setReport] = useState<StorageReport | null>(null);
  const [clearing, setClearing] = useState(false);
  const [freed, setFreed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await scanPhotoStorage();
    setReport(next);
  }, []);

  // Read on arrival, and again whenever an upload finishes: a sync deletes its
  // own photos, so the number drops without the worker doing anything.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  useEffect(
    () =>
      subscribeSync((event) => {
        if (!event.running) void load();
      }),
    [load]
  );

  async function clear() {
    if (clearing) return;
    setClearing(true);
    setFreed(null);
    const result = await clearLeftoverPhotos();
    await load();
    setClearing(false);
    // Only claim freed space when a file actually went: a scan can come back
    // empty if a sync finished between opening the alert and pressing Clear.
    if (result.removed > 0) {
      setFreed(t("Freed {size}.", { size: formatBytes(result.freedBytes) }));
    }
  }

  function confirmClear() {
    if (!report || report.leftoverCount === 0 || clearing) return;
    Alert.alert(
      t("Clear leftover photos?"),
      t(
        "These photos are not attached to any record. The copies on the server are not touched."
      ),
      [
        { text: t("Keep"), style: "cancel" },
        { text: t("Clear"), style: "destructive", onPress: () => void clear() },
      ]
    );
  }

  const leftover = report?.leftoverCount ?? 0;
  const hasPhotos = (report?.photoCount ?? 0) > 0;

  return (
    <Card padded>
      <Text style={styles.size}>{report ? formatBytes(report.photoBytes) : "—"}</Text>
      {report ? (
        <Text style={styles.meta}>
          {t("{count} photos on this phone", { count: report.photoCount })}
        </Text>
      ) : null}

      {hasPhotos ? (
        <View style={styles.breakdown}>
          <Text style={styles.line}>
            {t("{count} kept for unfinished records", { count: report?.keptCount ?? 0 })}
          </Text>
          <Text style={[styles.line, leftover > 0 ? styles.lineStrong : null]}>
            {t("{count} leftover from records never saved", { count: leftover })}
          </Text>
        </View>
      ) : null}

      <View style={styles.action}>
        <Button
          title={
            leftover > 0
              ? t("Clear {count} leftover photos", { count: leftover })
              : t("Nothing to clean up")
          }
          variant="secondary"
          onPress={confirmClear}
          disabled={leftover === 0 || report === null}
          loading={clearing}
        />
      </View>

      {freed ? <Text style={styles.freed}>{freed}</Text> : null}

      <Text style={styles.hint}>
        {t("Uploaded photos leave the phone as soon as they reach the server.")}
      </Text>
    </Card>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    size: { ...type.number, fontSize: 26 },
    meta: { ...type.caption, marginTop: 2 },
    breakdown: { marginTop: spacing.md, gap: 3 },
    line: { ...type.caption, fontSize: 13, lineHeight: 19 },
    lineStrong: { color: colors.ink },
    action: { marginTop: spacing.md },
    freed: { ...type.caption, color: colors.approvedInk, marginTop: 8 },
    hint: { ...type.caption, lineHeight: 17, marginTop: spacing.sm },
  });
