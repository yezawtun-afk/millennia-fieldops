import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { useI18n } from "../i18n";
import { Banner, Button, Card, ChipGroup, Field, Input, SectionTitle } from "../components/ui";
import { SpeciesPicker } from "../components/SpeciesPicker";
import { AIAnalyzingPulse } from "../components/AIAnalyzingPulse";
import { AiSuggestionSheet } from "../components/AiSuggestionSheet";
import {
  analyzePhoto as analyzeRecordPhoto,
  hasAnyAiSuggestion,
  unclearPhotoMessage,
  type AiSuggestion,
} from "../lib/ai";
import { colors, radius, spacing, type } from "../theme";
import { enqueueRecord, getOutbox, markPending, saveDraft } from "../lib/sqlite";
import { fetchZones } from "../lib/api";
import { useOnlineStatus } from "../lib/network";
import {
  GPS_ACCURACY_LIMIT_M,
  getCurrentCoordinates,
  isGpsAccuracyGood,
  type Coordinates,
} from "../lib/location";
import {
  defaultUnitFor,
  getReadingDefinition,
  validateReading,
} from "../lib/measurements";
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
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);

  // AI photo assist
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiPhotoUri, setAiPhotoUri] = useState<string | null>(null);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const aiRequestRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

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

  // Invalidate an in-flight AI request and drop any suggestion on screen.
  function clearAi() {
    aiRequestRef.current += 1;
    setAiBusy(false);
    setAiSuggestion(null);
    setAiPhotoUri(null);
    setAiSheetOpen(false);
  }

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
      clearAi();
      const p = row.payload;

      setType(p.type);
      setTitle(p.title);
      setNotes(p.notes ?? "");
      setPhotos(p.photos);
      setCoords(
        p.latitude !== null && p.longitude !== null
          ? {
              latitude: p.latitude,
              longitude: p.longitude,
              accuracy: p.gps_accuracy ?? null,
            }
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
      setReadingUnit(p.reading_unit ?? defaultUnitFor(p.reading_type));
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
    clearAi();
    setTitle("");
    setNotes("");
    setPhotos([]);
    setPhotoNote(null);
    setCoords(null);
    setSpeciesPickerOpen(false);
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

    clearAi();
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
    clearAi();
    setPhotos((prev) => prev.filter((item) => item !== uri));
    void deletePhoto(uri);
  }

  async function captureGps() {
    setGpsBusy(true);
    setMessage(null);
    const result = await getCurrentCoordinates();
    setGpsBusy(false);
    if (!result) {
      Alert.alert(
        t("Location unavailable"),
        t("Allow location access to record GPS coordinates.")
      );
      return;
    }
    setCoords(result);

    if (result.accuracy == null) {
      setMessage({
        kind: "warning",
        text: t("GPS accuracy is unknown. Move to open sky and capture the location again."),
      });
    } else if (!isGpsAccuracyGood(result.accuracy)) {
      setMessage({
        kind: "warning",
        text: t(
          "GPS accuracy is ±{accuracy} m. Move to open sky and capture again. Records need ±{limit} m or better.",
          { accuracy: Math.round(result.accuracy), limit: GPS_ACCURACY_LIMIT_M }
        ),
      });
    }
  }

  function chooseReadingType(next: string) {
    if (next === readingType) return;
    setReadingType(next);
    setReadingUnit(defaultUnitFor(next));
    setReadingValue("");
  }

  async function runPhotoAnalysis() {
    // Soil and water records have no AI assist: the reading must come from the
    // instrument, not from a guess about the photo.
    if (type === "soil_water") return;

    const photo = photos[0];
    if (!photo) {
      setMessage({ kind: "warning", text: t("Add a photo first.") });
      return;
    }
    if (!online) {
      setMessage({
        kind: "warning",
        text: t("AI needs a connection. Fill the form manually or save a draft."),
      });
      return;
    }

    const requestId = aiRequestRef.current + 1;
    aiRequestRef.current = requestId;
    setAiBusy(true);
    setAiPhotoUri(photo);
    setAiSuggestion(null);
    setMessage(null);

    const result = await analyzeRecordPhoto(photo, type);
    if (aiRequestRef.current !== requestId) return;

    setAiBusy(false);

    if (!result.ok) {
      setAiPhotoUri(null);
      setMessage({ kind: "error", text: t(result.message) });
      return;
    }

    const suggestion = result.suggestion;
    if (!hasAnyAiSuggestion(suggestion)) {
      setAiPhotoUri(null);
      setMessage({
        kind: "warning",
        text: t(unclearPhotoMessage(type)),
      });
      return;
    }

    setAiSuggestion(suggestion);
    setAiSheetOpen(true);
  }

  function applyAiSuggestion(suggestion: AiSuggestion) {
    let keptExisting = false;

    if (suggestion.recordType === "hazard") {
      if (!title.trim() && suggestion.title) {
        setTitle(suggestion.title);
      } else if (title.trim() && suggestion.title) {
        keptExisting = true;
      }

      if (!hazardType && suggestion.hazard_type) {
        setHazardType(suggestion.hazard_type);
      } else if (hazardType && suggestion.hazard_type) {
        keptExisting = true;
      }

      if (!severity && suggestion.severity) {
        setSeverity(suggestion.severity);
      } else if (severity && suggestion.severity) {
        keptExisting = true;
      }
    } else if (suggestion.recordType === "flora") {
      if (!title.trim() && suggestion.title) {
        setTitle(suggestion.title);
      } else if (title.trim() && suggestion.title) {
        keptExisting = true;
      }

      if (!species.trim() && suggestion.species_name) {
        setSpecies(suggestion.species_name);
      } else if (species.trim() && suggestion.species_name) {
        keptExisting = true;
      }

      if (!growthStage && suggestion.growth_stage) {
        setGrowthStage(suggestion.growth_stage);
      } else if (growthStage && suggestion.growth_stage) {
        keptExisting = true;
      }

      if (!healthCondition && suggestion.health_condition) {
        setHealthCondition(suggestion.health_condition);
      } else if (healthCondition && suggestion.health_condition) {
        keptExisting = true;
      }

      if (!estimatedCount.trim() && suggestion.estimated_count) {
        setEstimatedCount(String(suggestion.estimated_count));
      } else if (estimatedCount.trim() && suggestion.estimated_count) {
        keptExisting = true;
      }
    }

    if (!notes.trim() && suggestion.notes) {
      setNotes(suggestion.notes);
    } else if (notes.trim() && suggestion.notes) {
      keptExisting = true;
    }

    setAiSuggestion(null);
    setAiPhotoUri(null);
    setAiSheetOpen(false);
    setMessage({
      kind: "success",
      text: keptExisting
        ? t("AI suggestions applied. Fields you already filled were kept.")
        : t("AI suggestions applied. Check every field before saving."),
    });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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
      gps_accuracy: coords?.accuracy ?? null,
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
    if (type === "soil_water") {
      const readingError = validateReading(readingType, readingValue, readingUnit);
      if (readingError) return t(readingError.key, readingError.params);
    }
    if (!coords) return t("Capture a GPS location before submitting.");
    if (coords.accuracy == null) {
      return t("GPS accuracy is unknown. Capture the location again before submitting.");
    }
    if (!isGpsAccuracyGood(coords.accuracy)) {
      return t(
        "GPS accuracy is ±{accuracy} m. Move to open sky and capture again. Records need ±{limit} m or better.",
        { accuracy: Math.round(coords.accuracy), limit: GPS_ACCURACY_LIMIT_M }
      );
    }
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

  const readingDefinition = getReadingDefinition(readingType);
  const unitOptions = readingDefinition
    ? readingUnit && !readingDefinition.units.includes(readingUnit)
      ? [...readingDefinition.units, readingUnit]
      : readingDefinition.units
    : [];
  const readingError =
    readingType && readingValue.trim()
      ? validateReading(readingType, readingValue, readingUnit)
      : null;
  const aiHint = !online
    ? t("AI needs a connection. Fill the form manually or save a draft.")
    : photos.length === 0
      ? t("Add a photo first.")
      : type === "flora"
        ? t(
            "Sends the first photo for AI analysis. Best when leaves and stems are clear. AI can be wrong - review before saving."
          )
        : t("Sends the first photo for AI analysis. AI can be wrong - review before saving.");

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
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
            if (found && found.value !== type) {
              clearAi();
              setType(found.value);
            }
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
                <Pressable
                  onPress={() => setSpeciesPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("Browse species catalog")}
                  style={({ pressed }) => [
                    styles.catalogButton,
                    pressed ? { opacity: 0.7 } : null,
                  ]}
                >
                  <Ionicons name="search" size={15} color={colors.primaryDark} />
                  <Text style={styles.catalogText}>{t("Browse species catalog")}</Text>
                </Pressable>
                <Text style={styles.helper}>
                  {t("Pick from the site catalog or type a name.")}
                </Text>
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
                  onChange={chooseReadingType}
                  labelFor={t}
                />
              </Field>
              <Field label={t("Value")}>
                <Input
                  value={readingValue}
                  onChangeText={setReadingValue}
                  keyboardType="decimal-pad"
                  placeholder={
                    readingDefinition
                      ? t("e.g. {value}", { value: readingDefinition.example })
                      : t("Choose a reading type first.")
                  }
                />
                {readingDefinition ? (
                  <Text style={styles.helper}>{t(readingDefinition.hint)}</Text>
                ) : null}
                {readingError ? (
                  <Text style={styles.helperError}>
                    {t(readingError.key, readingError.params)}
                  </Text>
                ) : null}
              </Field>
              <Field label={t("Unit")}>
                {readingDefinition ? (
                  <ChipGroup
                    options={unitOptions}
                    value={readingUnit || null}
                    onChange={setReadingUnit}
                  />
                ) : (
                  <Text style={styles.helper}>{t("Choose a reading type first.")}</Text>
                )}
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
            <>
              <Text style={styles.coords}>
                {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </Text>
              <Text
                style={[
                  styles.helper,
                  !isGpsAccuracyGood(coords.accuracy) ? styles.helperError : null,
                ]}
              >
                {coords.accuracy == null
                  ? t("Accuracy unknown - capture again before submitting.")
                  : t("GPS accuracy ±{accuracy} m · {quality}", {
                      accuracy: Math.round(coords.accuracy),
                      quality: isGpsAccuracyGood(coords.accuracy) ? t("Good") : t("Weak"),
                    })}
              </Text>
              {!isGpsAccuracyGood(coords.accuracy) ? (
                <Text style={styles.helper}>
                  {t(
                    "Move to open sky and tap Update GPS location. Records need ±{limit} m or better.",
                    { limit: GPS_ACCURACY_LIMIT_M }
                  )}
                </Text>
              ) : null}
            </>
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

          {type !== "soil_water" ? (
            <View style={styles.aiPanel}>
              <View style={styles.aiHeading}>
                <Ionicons name="sparkles-outline" size={17} color={colors.primaryDark} />
                <Text style={styles.aiTitle}>{t("AI photo assist")}</Text>
              </View>
              <Text style={styles.helper}>{aiHint}</Text>
              <View style={{ height: 10 }} />
              <Button
                title={aiBusy ? t("Analyzing photo...") : t("Auto-fill from photo")}
                variant="secondary"
                onPress={runPhotoAnalysis}
                loading={aiBusy}
                disabled={!online || photos.length === 0 || aiBusy}
              />
              {aiBusy ? <AIAnalyzingPulse /> : null}
            </View>
          ) : null}
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
      <SpeciesPicker
        visible={speciesPickerOpen}
        onClose={() => setSpeciesPickerOpen(false)}
        onSelect={setSpecies}
      />
      <AiSuggestionSheet
        visible={aiSheetOpen}
        photoUri={aiPhotoUri}
        suggestion={aiSuggestion}
        onClose={() => {
          setAiSheetOpen(false);
          setAiSuggestion(null);
          setAiPhotoUri(null);
        }}
        onApply={applyAiSuggestion}
      />
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
  helperError: { fontSize: 12, color: colors.rejectedInk, marginTop: 6, lineHeight: 17 },
  catalogButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    minHeight: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.control,
    backgroundColor: colors.panel,
  },
  catalogText: { fontSize: 12, fontWeight: "600", color: colors.primaryDark },
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
  aiPanel: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  aiHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiTitle: { fontSize: 13, fontWeight: "700", color: colors.primaryDark },
  footerHint: { fontSize: 12, color: colors.muted, marginTop: spacing.md, lineHeight: 18 },
});
