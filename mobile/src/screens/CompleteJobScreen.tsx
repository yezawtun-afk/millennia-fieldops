// Finish an approved hazard job.
//
// The review decides whether the report is valid; this screen records that the
// work itself was done. It writes a note and up to three "after" photos through
// the complete_record() database function, which checks that the caller owns
// the record, that it is an approved hazard, and that it is not already done.
// The review status is never changed here.
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { completeRecord, fetchRecord, signPhotoUrls } from "../lib/api";
import { captureFromCamera, deletePhoto, pickFromLibrary } from "../lib/photos";
import { removeRecordPhotos, uploadRecordPhoto } from "../lib/upload";
import { useOnlineStatus } from "../lib/network";
import { Banner, Button, Card, Input, Pill, SectionTitle } from "../components/ui";
import { radius, spacing, type ThemeScale } from "../theme";
import { useTheme, useThemedStyles } from "../lib/useTheme";
import {
  PRIORITY_LABELS,
  SEVERITY_LABELS,
  daysUntilDue,
  formatDate,
  formatDueDate,
  isOverdue,
} from "../lib/format";
import type { FieldRecord } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "CompleteJob">;

const MAX_PHOTOS = 3;
const MAX_NOTE = 800;

export function CompleteJobScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { profile, session } = useAuth();
  const { t } = useI18n();
  const styles = useThemedStyles(makeStyles);
  const { colors, tones } = useTheme();
  const online = useOnlineStatus();
  const userId = session?.user.id ?? profile?.id ?? null;

  const [record, setRecord] = useState<FieldRecord | null>(null);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local copies are removed when the screen is left without saving, so a
  // cancelled finish does not leave compressed photos in the app folder.
  const photosRef = useRef<string[]>([]);
  const keepLocalPhotos = useRef(false);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(
    () => () => {
      if (!keepLocalPhotos.current) {
        for (const uri of photosRef.current) void deletePhoto(uri);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await fetchRecord(id);
      if (!active) return;
      setRecord(data);
      // The "before" photo is stored as a private path; sign it so the worker
      // can see what the problem looked like before walking out there.
      if (data?.photos?.length) {
        const urls = await signPhotoUrls(data.photos).catch(() => []);
        if (active) setBeforePhotos(urls);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  async function addPhoto(source: "camera" | "library") {
    if (picking || photos.length >= MAX_PHOTOS) return;
    setPicking(true);
    try {
      const captured = source === "camera" ? await captureFromCamera() : await pickFromLibrary();
      if (!captured) return;
      setPhotos((prev) =>
        prev.length >= MAX_PHOTOS ? prev : [...prev, captured.uri]
      );
    } finally {
      setPicking(false);
    }
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((item) => item !== uri));
    void deletePhoto(uri);
  }

  function confirmSubmit() {
    Alert.alert(
      t("Mark this job as fixed?"),
      t("Your supervisor will check your photo, then close the job."),
      [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Mark as fixed"), onPress: () => void submit() },
      ]
    );
  }

  async function submit() {
    if (!record || !userId || busy) return;
    if (!online) {
      setError(t("You need a connection to mark a job done."));
      return;
    }
    if (photos.length === 0) {
      setError(t("Add at least one photo of the finished work."));
      return;
    }

    setBusy(true);
    setError(null);

    // Upload first, then hand the paths to the database function. If anything
    // fails, remove the files that were already stored so no orphan is left.
    const uploaded: string[] = [];
    // A per-attempt suffix keeps retries from colliding with a file that a
    // previous, interrupted attempt may have left behind.
    const token = Date.now().toString(36);
    try {
      for (let i = 0; i < photos.length; i += 1) {
        const path = `${userId}/${record.id}/after-${token}-${i}.jpg`;
        uploaded.push(await uploadRecordPhoto(photos[i], path));
      }
    } catch {
      await removeRecordPhotos(uploaded);
      setBusy(false);
      setError(t("Could not upload the photos. Try again."));
      return;
    }

    const result = await completeRecord(record.id, note.trim() || null, uploaded);
    if (result.error) {
      // The call may have committed and only the reply was lost, especially on
      // a weak connection. Check before deleting files the row may now point at.
      const current = await fetchRecord(record.id).catch(() => null);
      if (current?.completed_at) {
        keepLocalPhotos.current = true;
        for (const uri of photos) {
          await deletePhoto(uri);
        }
        setBusy(false);
        navigation.goBack();
        return;
      }
      await removeRecordPhotos(uploaded);
      setBusy(false);
      setError(
        /already (complete|closed)/i.test(result.error)
          ? t("This job is already complete.")
          : t("Could not mark the job as done. Try again.")
      );
      return;
    }

    keepLocalPhotos.current = true;
    for (const uri of photos) {
      await deletePhoto(uri);
    }
    setBusy(false);
    navigation.goBack();
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
        <Text style={styles.muted}>
          {t("This record could not be loaded. You may be offline.")}
        </Text>
      </View>
    );
  }

  const holder = record.assigned_to ?? record.submitted_by;
  const isHolder = Boolean(userId && holder === userId);
  const isCompleted = Boolean(record.completed_at);
  const isClosed = Boolean(record.closed_at);
  const canFinish =
    isHolder &&
    record.type === "hazard" &&
    record.status === "approved" &&
    !isCompleted &&
    !isClosed;

  // The details screen only offers this button for an open job, but a record
  // can change (or a link can be reused), so explain instead of showing a form
  // that the database would refuse.
  if (!canFinish) {
    const reason = isClosed
      ? t("This job is already closed.")
      : isCompleted
        ? t("This job is already finished. Your supervisor will verify it.")
        : !isHolder
          ? t("Only the worker assigned to this job can finish it.")
          : record.type !== "hazard"
            ? t("Only hazard reports have a job to finish.")
            : t("The report must be approved before the job can be finished.");

    return (
      <View style={styles.centered}>
        <Ionicons
          name={isCompleted || isClosed ? "checkmark-circle-outline" : "lock-closed-outline"}
          size={28}
          color={isCompleted || isClosed ? colors.approvedInk : colors.muted}
        />
        <Text style={styles.centeredText}>{reason}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.rowLeft}>
          <Pill
            label={t("Approved")}
            color={colors.approvedInk}
            background={colors.approvedSoft}
            icon={<Ionicons name="checkmark-circle" size={13} color={colors.approvedInk} />}
          />
          {record.severity ? (
            <Pill
              label={t(SEVERITY_LABELS[record.severity])}
              color={tones.severity[record.severity].fg}
              background={tones.severity[record.severity].bg}
            />
          ) : null}
        </View>

        <Text style={styles.title}>{record.title}</Text>
        <Text style={styles.meta}>
          {record.zone?.name ?? t("No zone")} Â· {t("Approved")}{" "}
          {record.reviewed_at ? formatDate(record.reviewed_at) : ""}
        </Text>

        {record.assigned_to ? (
          <View style={styles.assignment}>
            <Text style={styles.assignmentLine}>
              {t("Assigned to {name}", {
                name: record.assignee?.full_name ?? t("a field worker"),
              })}
            </Text>
            <View style={styles.rowLeft}>
              {record.priority ? (
                <Pill
                  label={t(PRIORITY_LABELS[record.priority])}
                  color={tones.priority[record.priority].fg}
                  background={tones.priority[record.priority].bg}
                />
              ) : null}
              {record.due_on ? (
                <Pill
                  label={
                    isOverdue(record)
                      ? t("{count}d overdue", { count: Math.abs(daysUntilDue(record.due_on) ?? 0) })
                      : t("Due {date}", { date: formatDueDate(record.due_on) })
                  }
                  color={isOverdue(record) ? colors.rejectedInk : colors.muted}
                  background={isOverdue(record) ? colors.rejectedSoft : colors.panel}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {record.reopen_reason ? (
          <Text style={styles.feedback}>
            {t("Sent back: {reason}", { reason: record.reopen_reason })}
          </Text>
        ) : null}

        {record.supervisor_feedback ? (
          <Text style={styles.feedback}>
            {t("Comment: {comment}", { comment: record.supervisor_feedback })}
          </Text>
        ) : null}

        {!online || error ? (
          <View style={{ marginTop: spacing.lg }}>
            {!online ? (
              <Banner kind="warning">{t("You need a connection to mark a job done.")}</Banner>
            ) : null}
            {error ? <Banner kind="error">{error}</Banner> : null}
          </View>
        ) : null}

        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("Before")}</SectionTitle>
          {beforePhotos.length > 0 ? (
            <View style={styles.photoRow}>
              {beforePhotos.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.photo} />
              ))}
            </View>
          ) : (
            <Text style={styles.helper}>{t("No photo was attached to the report.")}</Text>
          )}
        </Card>

        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("What did you do?")}</SectionTitle>
          <Input
            value={note}
            onChangeText={(value) => {
              setNote(value);
              if (error) setError(null);
            }}
            placeholder={t("Add a short note about the work (optional).")}
            accessibilityLabel={t("What did you do?")}
            multiline
            maxLength={MAX_NOTE}
            textAlignVertical="top"
            style={styles.noteInput}
          />
        </Card>

        <Card padded style={styles.cardSpacing}>
          <SectionTitle>{t("After photos")}</SectionTitle>
          <Text style={styles.helper}>
            {t("At least one photo of the finished work, up to 3. They are shrunk on the phone before upload.")}
          </Text>

          {photos.length > 0 ? (
            <View style={styles.photoRow}>
              {photos.map((uri) => (
                <View key={uri} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} />
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => removePhoto(uri)}
                    accessibilityRole="button"
                    accessibilityLabel={t("Remove photo")}
                    hitSlop={6}
                  >
                    <Text style={styles.photoRemoveText}>x</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.photoButtons}>
            <Button
              title={t("Take photo")}
              variant="secondary"
              onPress={() => void addPhoto("camera")}
              disabled={picking || photos.length >= MAX_PHOTOS}
              style={styles.flexBtn}
            />
            <View style={{ width: 10 }} />
            <Button
              title={t("From library")}
              variant="secondary"
              onPress={() => void addPhoto("library")}
              disabled={picking || photos.length >= MAX_PHOTOS}
              style={styles.flexBtn}
            />
          </View>
        </Card>

        <View style={styles.submit}>
          <Button
            title={t("Mark as fixed")}
            onPress={confirmSubmit}
            loading={busy}
            disabled={!online || busy || photos.length === 0}
          />
          <Text style={styles.footerHint}>
            {t("The job stays open until a supervisor verifies your photo.")}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = ({ colors, type }: ThemeScale) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.page },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.page,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    centeredText: { ...type.body, textAlign: "center", color: colors.muted, lineHeight: 21 },
    rowLeft: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" },
    title: { ...type.title, fontSize: 22, marginTop: spacing.md },
    meta: { ...type.subhead, marginTop: 3 },
    feedback: {
      fontSize: 14,
      color: colors.ink,
      marginTop: spacing.md,
      lineHeight: 20,
      backgroundColor: colors.panel,
      borderRadius: radius.sm,
      padding: spacing.md,
    },
    cardSpacing: { marginTop: spacing.lg },
    assignment: { marginTop: spacing.md, gap: spacing.sm },
    assignmentLine: { fontSize: 14, color: colors.ink },
    noteInput: { minHeight: 96 },
    helper: { ...type.caption, lineHeight: 17 },
    photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.md },
    photoWrap: { position: "relative" },
    photo: { width: 84, height: 84, borderRadius: radius.sm, backgroundColor: colors.line },
    photoRemove: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.rejected,
      alignItems: "center",
      justifyContent: "center",
    },
    photoRemoveText: { color: colors.onTint, fontWeight: "600", fontSize: 12, lineHeight: 15 },
    photoButtons: { flexDirection: "row", marginTop: spacing.md, gap: spacing.sm },
    flexBtn: { flex: 1 },
    submit: { marginTop: spacing.xl },
    footerHint: { ...type.caption, marginTop: spacing.sm, textAlign: "center", lineHeight: 17 },
    muted: { fontSize: 14, color: colors.muted, lineHeight: 20, textAlign: "center" },
});
