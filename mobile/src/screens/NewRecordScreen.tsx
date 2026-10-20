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
import { Banner, Button, Card, ChipGroup, Field, Input, SectionTitle } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import { enqueueRecord, getOutbox, markPending, saveDraft } from "../lib/sqlite";
import { syncOutbox } from "../lib/sync";
import { fetchZones } from "../lib/api";
import { useOnlineStatus } from "../lib/network";
import { getCurrentCoordinates } from "../lib/location";
import { captureFromCamera, deletePhoto, pickFromLibrary } from "../lib/photos";
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

export function NewRecordScreen({ navigation, route }: Props) {
  const { profile, session } = useAuth();
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
      setMessage({ kind: "info", text: "Draft loaded - finish the details, then tap Save record." });
      // Clear the parameter so re-opening the tab starts a blank record.
      navigation.setParams({ draftId: undefined });
    })();

    return () => {
      active = false;
    };
  }, [draftParam, navigation]);

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
    const uri = source === "camera" ? await captureFromCamera() : await pickFromLibrary();
    if (uri) setPhotos((prev) => [...prev, uri]);
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
      Alert.alert("Location unavailable", "Allow location access to record GPS coordinates.");
      return;
    }
    setCoords({ latitude: result.latitude, longitude: result.longitude });
  }

  // Everything the form holds right now, ready to be stored on the phone.
  function buildPayload(): Omit<OutboxRecord, "localId"> {
    return {
      type,
      title: title.trim() || "Untitled draft",
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
    if (!title.trim()) return "Give the record a short title - or save it as a draft.";
    if (type === "flora" && !species.trim()) return "Add the species name - or save it as a draft.";
    if (type === "hazard" && !hazardType) return "Choose a hazard type - or save it as a draft.";
    if (type === "hazard" && !severity) return "Choose a severity - or save it as a draft.";
    if (type === "soil_water" && !readingType) return "Choose a reading type - or save it as a draft.";
    if (type === "soil_water" && !readingValue.trim())
      return "Add the reading value - or save it as a draft.";
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
        "Draft saved",
        "This record is kept as a draft on this phone. Open My records to finish it and submit it when you have signal."
      );
      navigation.navigate("Records");
    } catch (error) {
      setBusy(false);
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not save the draft.",
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
        text: "You are offline. Tap Save as draft instead - open it from My records and submit it once you have signal.",
      });
      return;
    }

    if (!userId) {
      setMessage({ kind: "error", text: "Your account could not be read. Log out and sign in again." });
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
      const result = await syncOutbox(userId);
      setBusy(false);

      if (result.uploaded > 0) {
        Alert.alert("Saved", "The record was uploaded for review.");
      } else {
        Alert.alert(
          "Saved on the phone",
          "The record is stored on this phone and will upload automatically when you have a connection."
        );
      }
      navigation.navigate("Records");
    } catch (error) {
      setBusy(false);
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not save the record.",
      });
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{draftId ? "Finish the draft" : "New record"}</Text>
          <Text style={styles.subhead}>
            Saved on the phone first. It uploads by itself when there is signal.
          </Text>
        </View>

        <SectionTitle>Record type</SectionTitle>
        <ChipGroup
          options={TYPE_OPTIONS.map((o) => o.label)}
          value={TYPE_OPTIONS.find((o) => o.value === type)?.label ?? null}
          onChange={(label) => {
            const found = TYPE_OPTIONS.find((o) => o.label === label);
            if (found) setType(found.value);
          }}
        />

        <View style={{ height: 16 }} />
        {!online ? (
          <Banner kind="warning">
            You are offline. Save this as a draft now - open it from My records and tap Save record once
            you have signal again.
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
          <Field label="Title">
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={
                type === "flora"
                  ? "e.g. Resprouting ferns - southern slope"
                  : type === "hazard"
                    ? "e.g. Blocked culvert near access road"
                    : "e.g. Wetland water reading"
              }
            />
          </Field>

          <Field label="Monitoring zone">
            <ChipGroup
              options={["No zone", ...zones.map((z) => z.name)]}
              value={zoneId ? zones.find((z) => z.id === zoneId)?.name ?? "No zone" : "No zone"}
              onChange={(name) => {
                if (name === "No zone") setZoneId(null);
                else setZoneId(zones.find((z) => z.name === name)?.id ?? null);
              }}
            />
            {zones.length === 0 ? (
              <Text style={styles.helper}>Zones load when you are online. You can still save offline.</Text>
            ) : null}
          </Field>

          {type === "flora" ? (
            <>
              <Field label="Species name">
                <Input value={species} onChangeText={setSpecies} placeholder="e.g. Dicranopteris linearis" />
              </Field>
              <Field label="Growth stage">
                <ChipGroup options={GROWTH_STAGES} value={growthStage} onChange={setGrowthStage} />
              </Field>
              <Field label="Health condition">
                <ChipGroup options={HEALTH_CONDITIONS} value={healthCondition} onChange={setHealthCondition} />
              </Field>
              <Field label="Estimated count">
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
              <Field label="Hazard type">
                <ChipGroup options={HAZARD_TYPES} value={hazardType} onChange={setHazardType} />
              </Field>
              <Field label="Severity">
                <ChipGroup
                  options={SEVERITIES.map((s) => s.label)}
                  value={SEVERITIES.find((s) => s.value === severity)?.label ?? null}
                  onChange={(label) => setSeverity(SEVERITIES.find((s) => s.label === label)?.value ?? null)}
                />
              </Field>
            </>
          ) : null}

          {type === "soil_water" ? (
            <>
              <Field label="Reading type">
                <ChipGroup options={READING_TYPES} value={readingType} onChange={setReadingType} />
              </Field>
              <Field label="Value">
                <Input value={readingValue} onChangeText={setReadingValue} keyboardType="decimal-pad" placeholder="e.g. 6.8" />
              </Field>
              <Field label="Unit">
                <Input value={readingUnit} onChangeText={setReadingUnit} placeholder="e.g. pH / NTU / m" />
              </Field>
            </>
          ) : null}

          <Field label="Notes">
            <Input
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Anything worth remembering about this observation..."
            />
          </Field>
        </Card>

        <Card padded style={{ marginBottom: spacing.lg }}>
          <SectionTitle>Location</SectionTitle>
          {coords ? (
            <Text style={styles.coords}>
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.helper}>No GPS captured yet.</Text>
          )}
          <View style={{ height: 10 }} />
          <Button
            title={coords ? "Update GPS location" : "Capture GPS location"}
            variant="secondary"
            onPress={captureGps}
            loading={gpsBusy}
          />
        </Card>

        <Card padded style={{ marginBottom: spacing.lg }}>
          <SectionTitle>Photos</SectionTitle>
          <View style={styles.photoRow}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} />
                <Pressable
                  style={styles.photoRemove}
                  onPress={() => removePhoto(uri)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  hitSlop={6}
                >
                  <Text style={styles.photoRemoveText}>x</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.photoButtons}>
            <Button title="Take photo" variant="secondary" onPress={() => addPhoto("camera")} style={styles.flexBtn} />
            <View style={{ width: 10 }} />
            <Button title="From library" variant="secondary" onPress={() => addPhoto("library")} style={styles.flexBtn} />
          </View>
        </Card>

        <Button
          title={busy ? "Saving..." : online ? "Save record" : "Save record (needs connection)"}
          onPress={save}
          loading={busy}
          disabled={!online}
        />
        <View style={{ height: 10 }} />
        <Button title="Save as draft" variant="secondary" onPress={saveAsDraft} disabled={busy} />
        <Text style={styles.footerHint}>
          Records save on the phone first, then upload automatically - so you can keep working with no
          signal. Offline? Use "Save as draft", then submit it from My records when you are back online.
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
