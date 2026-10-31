// Shared design tokens for the mobile app.
// One source of truth: screens import these, components import these, nothing
// hard-codes a hex value or a padding number of its own.
//
// Colours come in two palettes (light and dark) and reach a component through
// useTheme(), never by importing a palette directly. Spacing, radius and shadow
// are the same in both themes.
import type { TextStyle } from "react-native";

// The light palette, which is the app as it has always looked. The keys are the
// contract: a dark palette must supply every one of them, and the Palette type
// below makes a missing key a compile error rather than a blank screen.
const light = {
  // Brand. The accent is used on data and one action per screen, never as
  // large chrome.
  forest: "#16342A",
  primary: "#1F6B4A",
  primaryDark: "#175539",
  primarySoft: "#EAF1EC",

  // Surfaces: canvas -> grouped card -> control.
  page: "#F1F3EE",
  card: "#FFFFFF",
  panel: "#F7F8F6",

  // Three text tiers and three line weights.
  ink: "#14181B",
  muted: "#5B615C",
  faint: "#6B6F6A",
  line: "#E7EAE5",
  rule: "#F1F3EF",
  control: "#D3D8D2",

  // Record types.
  flora: "#1F6B4A",
  floraSoft: "#E7F2EA",
  water: "#2B6CB0",
  waterSoft: "#E8F0F9",
  hazard: "#C4242A",
  hazardSoft: "#FDEEEE",

  // The live "you are here" marker. Yellow is deliberately outside the record
  // palette; the dark ink ring keeps it readable on pale map tiles.
  location: "#FFD400",
  locationInk: "#7A5D00",

  // Review status: pale tint plus the dark ink of the same hue.
  pending: "#92400E",
  pendingSoft: "#FFFBEB",
  pendingInk: "#92400E",
  approved: "#247B50",
  approvedSoft: "#DCFAE5",
  approvedInk: "#04250E",
  rejected: "#C4242A",
  rejectedSoft: "#FFEDEA",
  rejectedInk: "#831C1E",

  // Hazard severity ramp.
  sevLow: "#8A6516",
  sevMedium: "#C2410C",
  sevCritical: "#991B1B",
  sevLowSoft: "#F7F0DE",
  sevMediumSoft: "#FBE9DF",
  sevCriticalSoft: "#FBE3E3",

  // Text on a filled accent surface.
  onTint: "#FFFFFF",
};

/** Every colour the app draws, in one flat record of names. */
export type Palette = { [K in keyof typeof light]: string };

export const lightColors: Palette = light;

// The dark palette. This is not the light one inverted: a green-tinted charcoal
// reads as the same product at night, and every tint/ink pair was picked again
// so text still clears about 4:1 against the surface behind it. The brand hue
// survives, the paper does not.
export const darkColors: Palette = {
  forest: "#0C1F18",
  // Bright enough to read as an icon or a value on the dark cards, while a dark
  // label still clears 4.5:1 when this is used as a filled button.
  primary: "#3EA477",
  // Lighter than `primary` here, not darker: in light mode this token is the ink
  // used *on* a primarySoft surface, and a dark tint needs light ink.
  primaryDark: "#8FD9B4",
  primarySoft: "#1B2B23",

  page: "#101413",
  card: "#191E1C",
  panel: "#212724",

  ink: "#ECEFEA",
  muted: "#A8B0A9",
  faint: "#8E968F",
  line: "#2C3330",
  rule: "#252B28",
  control: "#3B433F",

  flora: "#79D3A4",
  floraSoft: "#17301F",
  water: "#7CB6EE",
  waterSoft: "#172433",
  hazard: "#F4837F",
  hazardSoft: "#33191A",

  location: "#FFD400",
  locationInk: "#FFE066",

  pending: "#F0B45E",
  pendingSoft: "#2E2415",
  pendingInk: "#F3C078",
  approved: "#6FD39B",
  approvedSoft: "#13291D",
  approvedInk: "#8FE3B4",
  rejected: "#F4837F",
  rejectedSoft: "#33181A",
  rejectedInk: "#F79C98",

  sevLow: "#DEC26A",
  sevMedium: "#F0A070",
  sevCritical: "#F08A86",
  sevLowSoft: "#2B2513",
  sevMediumSoft: "#2F1E14",
  sevCriticalSoft: "#331A1A",

  // Filled accent surfaces are light tints here, so their label is ink.
  onTint: "#0E1512",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;

// Soft shadows, drawn with the CSS-style `boxShadow` prop so Android and iOS
// render the same thing (the legacy shadow*/elevation props are not used).
export const shadow = {
  /** The raised centre button in the tab bar. */
  fab: "0 6px 16px rgba(20, 24, 27, 0.24)",
  /** The slide-in panel, casting to the right over the screen. */
  panel: "8px 0 24px rgba(15, 32, 24, 0.18)",
  /** A small floating control, such as the map's locate button. */
  control: "0 2px 8px rgba(20, 24, 27, 0.18)",
} as const;

// The type ramp, mirroring the platform ramp so text feels native. It carries
// colour, so it is built from a palette rather than exported as a constant.
export function makeType(colors: Palette) {
  return {
    title: { fontSize: 24, fontWeight: "600", color: colors.ink, letterSpacing: -0.3 },
    heading: { fontSize: 17, fontWeight: "600", color: colors.ink },
    body: { fontSize: 15, fontWeight: "400", color: colors.ink },
    subhead: { fontSize: 13, fontWeight: "400", color: colors.muted },
    label: { fontSize: 12, fontWeight: "500", color: colors.muted },
    caption: { fontSize: 12, fontWeight: "400", color: colors.muted },
    number: { fontSize: 24, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
  } as const satisfies Record<string, TextStyle>;
}

/** The style objects a component spreads into its own styles. */
export type TypeScale = ReturnType<typeof makeType>;

/** What a stylesheet factory is given: everything except spacing, radius, shadow. */
export interface ThemeScale {
  colors: Palette;
  type: TypeScale;
}
