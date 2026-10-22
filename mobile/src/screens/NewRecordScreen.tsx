import React, { useCallback, useEffect, useState } from "react";
import {
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
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { useI18n } from "../i18n";
import { Banner, Button, Card, ChipGroup, Field, Input, SectionTitle } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import { enqueueRecord, getOutbox, markPending, saveDraft } from "../lib/sqlite";
import { fetchZones } from "../lib/api";
import { useOnlineStatus } from "../lib/network";
import { getCurrentCoordinates } from "../lib/location";
import {
  captureFromCamera,
  deletePhoto,
  pickFromLibrary,
  type CapturedPhoto,
} from "../lib/photos";
import { GROWTH_STAGES, HAZARD_TYPES, HEALTH_CONDITIONS, READING_TYPES } from "../lib/format";
import type { HazardSeverity, OutboxRecord, RecordType, Zone } from "../lib/types";
import type { TabScreenProps } from "../navigation/types";

type Props = TabScreenProps<"New">;

const TYPE_OPTIONS: { label: string; value: RecordType }[] = [
  { label: "Flora", value: "flora" },
  { label: "Soil & Water", value: "soil_water" },
  { label: "Hazard", value: "hazard" },
];

const SEVERITIES: { label: string; value: HazardSeverity }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "Critical", value: "critical" },
];

const NO_ZONE = "No zone";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NewRecordScreen({ navigation, route }: Props) {
  const { profile, session } = useAuth();
  const { t } = useI18n();
  const { syncNow } = useSync();
  const online = useOnlineStatus();
  // The session survives restarts on the phone, so it is available offline even
  // when the profile row could not be fetched (the cached profile covers that).
  const userId = session?.user.id ?? profile?.id ?? null;
  const [type, setType] = useState<RecordType>(route.params?.type ?? "flora");
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  // Flora fields
  const [species, setSpecies] = useState("");
  const [growthStage, setGrowthStage] = useState<string | null>(null);
  const [healthCondition, setHealthCondition] = useState<string | null>(null);
  const [estimatedCount, setEstimatedCount] = useState("");

  // Hazard fields
  const [hazardType, setHazardType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<HazardSeverity | null>(null);

  // Soil / water fields
  const [readingType, setReadingType] = useState<string | null>(null);
  const [readingValue, setReadingValue] = useState("");
  const [readingUnit, setReadingUnit] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "info" | "success" | "error" | "warning";
    text: string;
  } | null>(null);
  // Set when the form is editing an unfinished draft (opened from My records).
  const [draftId, setDraftId] = useState<string | null>(null);
  // Kept so a draft remembers when the observation was actually made.
  const [observedDate, setObservedDate] = useState(() => new Date().toISOString());

  const draftParam = route.params?.draftId;

  useEffect(() => {
    if (!route.params?.draftId && route.params?.type) setType(route.params.type);
  }, [route.params?.type, route.params?.draftId]);

  // Open a draft chosen in "My records" and fill the form with what was saved.
  useEffect(() => {
    let active = true;
    if (!draftParam) return;

    (async () => {
      const row = await getOutbox(draftParam).catch(() => null);
      if (!active || !row) return;
      const p = row.payload;

      setType(p.type);
      setTitle(p.title);
      setNotes(p.notes ?? "");
      setPhotos(p.photos);
      setCoords(
        p.latitude !== null && p.longitude !== null
          ? { latitude: p.latitude, longitude: p.longitude }
          : null
      );
      setSpecies(p.species_name ?? "");
      setGrowthStage(p.growth_stage);
      setHealthCondition(p.health_condition);
      setEstimatedCount(p.estimated_count === null ? "" : String(p.estimated_count));
      setHazardType(p.hazard_type);
      setSeverity(p.severity);
      setReadingType(p.reading_type);
      setReadingValue(p.reading_value === null ? "" : String(p.reading_value));
      setReadingUnit(p.reading_unit ?? "");
      setZoneId(p.zone_id);
      setObservedDate(p.observed_date);
      setDraftId(row.localId);
      setMessage({
        kind: "info",
        text: t("Draft loaded - finish the details, then tap Save record."),
      });
      // Clear the parameter so re-opening the tab starts a blank record.
      navigation.setParams({ draftId: undefined });
    })();

    return () => {
      active = false;
    };
  }, [draftParam, navigation, t]);

  // Load zones when the screen gains focus (works from cache-free start too).
  useFocusEffect(
    useCallback(() => {
      fetchZones()
        .then(setZones)
        .catch(() => setZones([]));
    }, [])
  );

  function reset() {
    setTitle("");
    setNotes("");
    setPhotos([]);
    setPhotoNote(null);
    setCoords(null);
    setSpecies("");
    setGrowthStage(null);
    setHealthCondition(null);
    setEstimatedCount("");
    setHazardType(null);
    setSeverity(null);
    setReadingType(null);
    setReadingValue("");
    setReadingUnit("");
    setZoneId(null);
    setDraftId(null);
    setObservedDate(new Date().toISOString());
  }

  async function addPhoto(source: "camera" | "library") {
    const captured: CapturedPhoto | null =
      source === "camera" ? await captureFromCamera() : await pickFromLibrary();
    if (!captured) return;

    setPhotos((prev) => [...prev, captured.uri]);
    setPhotoNote(
      captured.originalBytes > 0
        ? t("Photo compressed: {from} → {to}", {
            from: formatBytes(captured.originalBytes),
            to: formatBytes(captured.bytes),
          })
        : t("Photo compressed for upload ({size})", { size: formatBytes(captured.bytes) })
    );
  }

  // Removing a photo from the form should also remove the copy on the phone;
  // otherwise every discarded shot stays in the app folder for good.
  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((item) => item !== uri));
    void deletePhoto(uri);
  }

  async function captureGps() {
    setGpsBusy(true);
    const result = await getCurrentCoordinates();
    setGpsBusy(false);
    if (!result) {
      Alert.alert(
        t("Location unavailable"),
        t("Allow location access to record GPS coordinates.")
      );
      return;
    }
    setCoords({ latitude: result.latitude, longitude: result.longitude });
  }

  // Everything the form holds right now, ready to be stored on the phone.
  function buildPayload(): Omit<OutboxRecord, "localId"> {
    return {
      type,
      title: title.trim() || t("Untitled draft"),
      zone_id: zoneId,
      observed_date: observedDate,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      notes: notes.trim() || null,
      photos,
      species_name: type === "flora" ? species.trim() || null : null,
      growth_stage: type === "flora" ? growthStage : null,
      health_condition: type === "flora" ? healthCondition : null,
      estimated_count:
        type === "flora" && estimatedCount.trim() ? Number(estimatedCount) : null,
      hazard_type: type === "hazard" ? hazardType : null,
      severity: type === "hazard" ? severity : null,
      reading_type: type === "soil_water" ? readingType : null,
      reading_value:
        type === "soil_water" && readingValue.trim() ? Number(readingValue) : null,
      reading_unit: type === "soil_water" ? readingUnit.trim() || null : null,
    };
  }

  // What still has to be filled in before a record counts as complete.
  function missingDetail(): string | null {
    if (!title.trim()) return t("Give the record a short title - or save it as a draft.");
    if (type === "flora" && !species.trim())
      return t("Add the species name - or save it as a draft.");
    if (type === "hazard" && !hazardType)
      return t("Choose a hazard type - or save it as a draft.");
    if (type === "hazard" && !severity)
      return t("Choose a severity - or save it as a draft.");
    if (type === "soil_water" && !readingType)
      return t("Choose a reading type - or save it as a draft.");
    if (type === "soil_water" && !readingValue.trim())
      return t("Add the reading value - or save it as a draft.");
    return null;
  }

  // Park an unfinished record. This is pure local storage, so it works with no
  // connection at all and needs no account details.
  async function saveAsDraft() {
    setBusy(true);
    setMessage(null);

    try {
      await saveDraft(buildPayload(), draftId ?? undefined);
      reset();
      setBusy(false);
      Alert.alert(
        t("Draft saved"),
        t(
          "This record is kept as a draft on this phone. Open My records to finish it and submit it when you have signal."
        )
      );
      navigation.navigate("Records");
    } catch (error) {
      setBusy(false);
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : t("Could not save the draft."),
      });
    }
  }

  async function save() {
    const missing = missingDetail();
    if (missing) {
      setMessage({ kind: "error", text: missing });
      return;
    }

    // Submitting needs the server. Offline the button is disabled, and this is
    // the backstop in case the connection dropped in the meantime.
    if (!online) {
      setMessage({
        kind: "warning",
        text: t(
          "You are offline. Tap Save as draft instead - open it from My records and submit it once you have signal."
        ),
      });
      return;
    }

    if (!userId) {
      setMessage({
        kind: "error",
        text: t("Your account could not be read. Log out and sign in again."),
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      if (draftId) {
        // Finishing a draft moves it from the drafts list into the upload queue.
        await saveDraft(buildPayload(), draftId);
        await markPending(draftId);
      } else {
        await enqueueRecord(buildPayload());
      }

      reset();

      // Try to upload right away; if the connection drops it stays queued.
      const result = await syncNow();
      setBusy(false);

      if (result && result.uploaded > 0) {
        Alert.alert(t("Saved"), t("The record was uploaded for review."));
      } else {
        Alert.alert(
          t("Saved on the phone"),
          t(
            "The record is stored on this phone and will upload automatically when you have a connection."
          )
        );
      }
      navigation.navigate("Records");
    } catch (error) {
      setBusy(false);
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : t("Could not save the record."),
      });
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{draftId ? t("Finish the draft") : t("New record")}</Text>
          <Text style={styles.subhead}>
            {t("Saved on the phone first. It uploads by itself when there is signal.")}
          </Text>
        </View>

        <SectionTitle>{t("Record type")}</SectionTitle>
        <ChipGroup
          options={TYPE_OPTIONS.map((o) => o.label)}
          value={TYPE_OPTIONS.find((o) => o.value === type)?.label ?? null}
          onChange={(label) => {
            const found = TYPE_OPTIONS.find((o) => o.label === label);
            if (found) setType(found.value);
          }}
          labelFor={t}
        />

        <View style={{ height: 16 }} />
        {!online ? (
          <Banner kind="warning">
            {t(
              "You are offline. Save this as a draft now - open it from My records and tap Save record once you have signal again."
            )}
          </Banner>
        ) : null}
        {message ? (
          <Banner
            kind={
              message.kind === "error"
                ? "error"
                : message.kind === "success"
                  ? "success"
                  : message.kind === "warning"
                    ? "warning"
                    : "info"
            }
          >
            {message.text}
          </Banner>
        ) : null}

        <Card padded style={{ marginBottom: spacing.lg }}>
          <Field label={t("Title")}>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={
                type === "flora"
                  ? t("e.g. Resprouting ferns - southern slope")
                  : type === "hazard"
                    ? t("e.g. Blocked culvert near access road")
                    : t("e.g. Wetland water reading")
              }
            />
          </Field>

          <Field label={t("Monitoring zone")}>
            <ChipGroup
              options={[NO_ZONE, ...zones.map((z) => z.name)]}
              value={zoneId ? zones.find((z) => z.id === zoneId)?.name ?? NO_ZONE : NO_ZONE}
              onChange={(name) => {
                if (name === NO_ZONE) setZoneId(null);
                else setZoneId(zones.find((z) => z.name === name)?.id ?? null);
              }}
              labelFor={(option) => (option === NO_ZONE ? t(NO_ZONE) : option)}
            />
            {zones.length === 0 ? (
              <Text style={styles.helper}>
                {t("Zones load when you are online. You can still save offline.")}
              </Text>
            ) : null}
          </Field>

          {type === "flora" ? (
            <>
              <Field label={t("Species name")}>
                <Input
                  value={species}
                  onChangeText={setSpecies}
                  placeholder="e.g. Dicranopteris linearis"
                />
              </Field>
              <Field label={t("Growth stage")}>
                <ChipGroup
                  options={GROWTH_STAGES}
                  value={growthStage}
                  onChange={setGrowthStage}
                  labelFor={t}
                />
              </Field>
              <Field label={t("Health condition")}>
                <ChipGroup
                  options={HEALTH_CONDITIONS}
                  value={healthCondition}
                  onChange={setHealthCondition}
                  labelFor={t}
                />
              </Field>
              <Field label={t("Estimated count")}>
                <Input
                  value={estimatedCount}
                  onChangeText={setEstimatedCount}
                  keyboardType="number-pad"
                  placeholder="e.g. 12"
                />
              </Field>
            </>
          ) : null}

          {type === "hazard" ? (
            <>
              <Field label={t("Hazard type")}>
                <ChipGroup
                  options={HAZARD_TYPES}
                  value={hazardType}
                  onChange={setHazardType}
                  labelFor={t}
                />
              </Field>
              <Field label={t("Severity")}>
                <ChipGroup
                  options={SEVERITIES.map((s) => s.label)}
                  value={SEVERITIES.find((s) => s.value === severity)?.label ?? null}
                  onChange={(label) =>
                    setSeverity(SEVERITIES.find((s) => s.label === label)?.value ?? null)
                  }
                  labelFor={t}
                />
              </Field>
            </>
          ) : null}

          {type === "soil_water" ? (
            <>
              <Field label={t("Reading type")}>
                <ChipGroup
                  options={READING_TYPES}
                  value={readingType}
                  onChange={setReadingType}
                  labelFor={t}
                />
              </Field>
              <Field label={t("Value")}>
                <Input
                  value={readingValue}
                  onChangeText={setReadingValue}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 6.8"
                />
              </Field>
              <Field label={t("Unit")}>
                <Input
                  value={readingUnit}
                  onChangeText={setReadingUnit}
                  placeholder={t("e.g. pH / NTU / m")}
                />
              </Field>
            </>
          ) : null}

          <Field label={t("Notes")}>
            <Input
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder={t("Anything worth remembering about this observation...")}
            />
          </Field>
        </Card>

        <Card padded style={{ marginBottom: spacing.lg }}>
          <SectionTitle>{t("Location")}</SectionTitle>
          {coords ? (
            <Text style={styles.coords}>
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.helper}>{t("No GPS captured yet.")}</Text>
          )}
          <View style={{ height: 10 }} />
          <Button
            title={coords ? t("Update GPS location") : t("Capture GPS location")}
            variant="secondary"
            onPress={captureGps}
            loading={gpsBusy}
          />
        </Card>

        <Card padded style={{ marginBottom: spacing.lg }}>
          <SectionTitle>{t("Photos")}</SectionTitle>
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
          {photoNote ? (
            <Text style={styles.photoNote}>
              {photoNote} · {t("Photos are shrunk on the phone before upload.")}
            </Text>
          ) : (
            <Text style={styles.helper}>{t("Photos are shrunk on the phone before upload.")}</Text>
          )}
          <View style={styles.photoButtons}>
            <Button
              title={t("Take photo")}
              variant="secondary"
              onPress={() => addPhoto("camera")}
              style={styles.flexBtn}
            />
            <View style={{ width: 10 }} />
            <Button
              title={t("From library")}
              variant="secondary"
              onPress={() => addPhoto("library")}
              style={styles.flexBtn}
            />
          </View>
        </Card>

        <Button
          title={
            busy ? t("Saving...") : online ? t("Save record") : t("Save record (needs connection)")
          }
          onPress={save}
          loading={busy}
          disabled={!online}
        />
        <View style={{ height: 10 }} />
        <Button title={t("Save as draft")} variant="secondary" onPress={saveAsDraft} disabled={busy} />
        <Text style={styles.footerHint}>
          {t(
            'Records save on the phone first, then upload automatically - so you can keep working with no signal. Offline? Use "Save as draft", then submit it from My records when you are back online.'
          )}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.lg },
  title: { ...type.title },
  subhead: { ...type.subhead, marginTop: 2, maxWidth: 320 },
  helper: { fontSize: 12, color: colors.muted, marginTop: 6 },
  photoNote: { fontSize: 12, color: colors.primaryDark, marginTop: 6, lineHeight: 17 },
  coords: { fontSize: 15, fontWeight: "500", color: colors.ink },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
  footerHint: { fontSize: 12, color: colors.muted, marginTop: spacing.md, lineHeight: 18 },
});
