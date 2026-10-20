// Shared design tokens for the mobile app.
// One source of truth: screens import these, components import these, nothing
// hard-codes a hex value or a padding number of its own.
import type { TextStyle } from "react-native";

export const colors = {
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
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;

// The type ramp, mirroring the platform ramp so text feels native.
export const type = {
  title: { fontSize: 24, fontWeight: "600", color: colors.ink, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, fontWeight: "400", color: colors.ink },
  subhead: { fontSize: 13, fontWeight: "400", color: colors.muted },
  label: { fontSize: 12, fontWeight: "500", color: colors.muted },
  caption: { fontSize: 12, fontWeight: "400", color: colors.muted },
  number: { fontSize: 24, fontWeight: "500", color: colors.ink, fontVariant: ["tabular-nums"] },
} as const satisfies Record<string, TextStyle>;
