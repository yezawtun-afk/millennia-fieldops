// The invasive check, as a small pill.
//
// Shown wherever a species name appears: the AI suggestion sheet, the form as
// the worker types, and the saved record. Nothing renders when the name is not
// in the site catalog - an unknown plant gets no label rather than a guess.
import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useI18n } from "../i18n";
import { useTheme } from "../lib/useTheme";
import { speciesStatusFor, type SpeciesStatus } from "../lib/species";
import { Pill } from "./ui";

const LABELS: Record<SpeciesStatus, string> = {
  native: "Native",
  introduced: "Introduced",
  invasive: "Invasive",
};

export function SpeciesStatusPill({
  name,
  style,
}: {
  name: string | null | undefined;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const status = speciesStatusFor(name);
  if (!status) return null;

  const tone = {
    native: { fg: colors.approvedInk, bg: colors.approvedSoft },
    introduced: { fg: colors.water, bg: colors.waterSoft },
    invasive: { fg: colors.hazard, bg: colors.hazardSoft },
  }[status];

  return (
    <View style={style}>
      <Pill label={t(LABELS[status])} color={tone.fg} background={tone.bg} />
    </View>
  );
}
