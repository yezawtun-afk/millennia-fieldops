// A searchable, offline species list. Picking a row fills the form's species
// field; typing a name that is not listed is still allowed from the form.
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { SPECIES_CATALOG, matchesSpecies, type SpeciesEntry } from "../lib/species";
import { colors, radius, spacing, type } from "../theme";
import { SearchInput } from "./ui";

export function SpeciesPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (scientificName: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  const matches = useMemo(
    () => SPECIES_CATALOG.filter((entry) => matchesSpecies(entry, query)),
    [query]
  );

  const manualName = query.trim();
  const canUseManual =
    manualName.length > 0 &&
    !SPECIES_CATALOG.some(
      (entry) => entry.scientific.toLowerCase() === manualName.toLowerCase()
    );

  function choose(name: string) {
    onSelect(name);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.title}>{t("Species catalog")}</Text>
            <Text style={styles.sub}>
              {t("Pick a site species or search for another name.")}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("Close")}
            hitSlop={8}
            style={styles.close}
          >
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("Search scientific or common name")}
            accessibilityLabel={t("Search species")}
          />
        </View>

        <FlatList
          data={matches}
          keyExtractor={(entry) => entry.scientific}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.line} />}
          renderItem={({ item }) => <SpeciesRow entry={item} onPress={() => choose(item.scientific)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="leaf-outline" size={22} color={colors.muted} />
              <Text style={styles.emptyTitle}>{t("No species found")}</Text>
              <Text style={styles.emptyHint}>
                {t("Close this list and type the name in the form.")}
              </Text>
            </View>
          }
        />

        {canUseManual ? (
          <Pressable
            onPress={() => choose(manualName)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.manual, pressed ? { opacity: 0.7 } : null]}
          >
            <Ionicons name="create-outline" size={17} color={colors.primaryDark} />
            <Text style={styles.manualText} numberOfLines={1}>
              {t('Use "{name}"', { name: manualName })}
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function SpeciesRow({ entry, onPress }: { entry: SpeciesEntry; onPress: () => void }) {
  const localNames = [entry.malay, entry.chinese].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: colors.panel } : null]}
    >
      <View style={styles.rowText}>
        <Text style={styles.scientific}>{entry.scientific}</Text>
        <Text style={styles.common} numberOfLines={1}>
          {entry.common}
          {localNames ? ` · ${localNames}` : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { ...type.title, fontSize: 22 },
  sub: { ...type.subhead, marginTop: 2 },
  close: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.control,
  },
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 0 },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  rowText: { flex: 1, minWidth: 0 },
  scientific: { ...type.body, fontSize: 15, fontWeight: "600", fontStyle: "italic" },
  common: { ...type.caption, marginTop: 2 },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
  },
  emptyTitle: { ...type.body, fontWeight: "600" },
  emptyHint: { ...type.caption, textAlign: "center" },
  manual: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  manualText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.primaryDark },
});
