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
import { colors, radius } from "../theme";
import { enqueueRecord } from "../lib/sqlite";
import { syncOutbox } from "../lib/sync";
import { fetchZones } from "../lib/api";
import { getCurrentCoordinates } from "../lib/location";
import { captureFromCamera, pickFromLibrary } from "../lib/photos";
import { GROWTH_STAGES, HAZARD_TYPES, HEALTH_CONDITIONS, READING_TYPES } from "../lib/format";
import type { HazardSeverity, RecordType, Zone } from "../lib/types";
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
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

export function NewRecordScreen({ navigation, route }: Props) {
  const { profile } = useAuth();
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
  const [message, setMessage] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (route.params?.type) setType(route.params.type);
  }, [route.params?.type]);

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
  }

  async function addPhoto(source: "camera" | "library") {
    const uri = source === "camera" ? await captureFromCamera() : await pickFromLibrary();
    if (uri) setPhotos((prev) => [...prev, uri]);
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

  async function save() {
    if (!profile) return;
    if (!title.trim()) {
      setMessage({ kind: "error", text: "Give the record a short title." });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const queued = await enqueueRecord({
        type,
        title: title.trim(),
        zone_id: zoneId,
        observed_date: new Date().toISOString(),
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
      });

      reset();

      // Try to upload right away; if offline it stays queued.
      const result = await syncOutbox(profile.id);
      setBusy(false);

      if (result.uploaded > 0) {
        Alert.alert("Saved", "The record was uploaded for review.");
      } else {
        Alert.alert(
          "Saved offline",
          `The record is stored on this phone (${queued.slice(0, 6)}) and will upload automatically.`
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
        {message ? <Banner kind={message.kind === "error" ? "error" : message.kind === "success" ? "success" : "info"}>{message.text}</Banner> : null}

        <Card style={{ marginBottom: 14 }}>
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

        <Card style={{ marginBottom: 14 }}>
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

        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>Photos</SectionTitle>
          <View style={styles.photoRow}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} />
                <Pressable style={styles.photoRemove} onPress={() => setPhotos((p) => p.filter((x) => x !== uri))}>
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

        <Button title={busy ? "Saving..." : "Save record"} onPress={save} loading={busy} />
        <Text style={styles.footerHint}>
          Records save on the phone first, then upload automatically - so you can keep working with no signal.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 48 },
  helper: { fontSize: 12, color: colors.muted, marginTop: 6 },
  coords: { fontSize: 15, fontWeight: "600", color: colors.ink },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrap: { position: "relative" },
  photo: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.line },
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
  photoRemoveText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13, lineHeight: 16 },
  photoButtons: { flexDirection: "row", marginTop: 12 },
  flexBtn: { flex: 1 },
  footerHint: { fontSize: 12, color: colors.muted, marginTop: 12, lineHeight: 18 },
});
