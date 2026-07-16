import { createContext, useContext } from "react";
import type { ColorSchemeName } from "react-native";

import { binColors, colors, fonts, logo, radii, spacing } from "@/lib/brand";

// Brand tokens are re-exported here so components have a single import site for
// anything visual (`@/lib/theme`). brand.ts mirrors docs/branding/theme.ts and is
// the source of truth for raw token values — change tokens there, not here.
export { binColors, colors, fonts, logo, radii, spacing };

// Font families as registered by expo-font (see the root layout). Each family has
// exactly one job per the brand guide: Manrope displays/headings, Inter body,
// IBM Plex Mono every label/eyebrow/timestamp. There is no Inter label style.
export const FONT = {
  display: fonts.display.fontFamily,
  heading: fonts.heading.fontFamily,
  body: fonts.body.fontFamily,
  bodyEmphasis: fonts.bodyEmphasis.fontFamily,
  utility: fonts.utility.fontFamily,
  utilityStrong: fonts.utilityStrong.fontFamily,
} as const;

/** A resolved, concrete theme — always one of two real palettes. */
export type ThemeName = "dark" | "light";

/**
 * What the user chose. "system" is a *preference*, not a theme: it resolves to a
 * ThemeName at render time from the OS scheme. Keeping the two types distinct means
 * nothing downstream can accidentally try to look up a palette called "system".
 */
export type ThemePreference = ThemeName | "system";

export type Theme = {
  bg: string;
  bgAlt: string;
  bgInput: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textBody: string;
  primary: string;
  primaryText: string;
  secondaryBg: string;
  secondaryText: string;
  navBg: string;
  navBorder: string;
  toggleTrack: string;
  toggleThumb: string;
  handleBar: string;
  segmentActiveBg: string;
  segmentActiveBorder: string;
  scrim: string;
};

// Light is the primary mode per the brand guide; every value maps to a named token.
export const lightTheme: Theme = {
  bg: colors.paper,
  bgAlt: colors.white,
  bgInput: "#F1F0EC",
  card: colors.white,
  cardBorder: colors.line,
  text: colors.ink,
  textMuted: colors.slate,
  textSubtle: "#8A9691",
  textBody: colors.ink,
  primary: colors.sproutDeep,
  primaryText: colors.white,
  secondaryBg: "rgba(57,179,120,0.10)",
  secondaryText: colors.sproutDeep,
  navBg: colors.paper,
  navBorder: colors.line,
  toggleTrack: colors.line,
  toggleThumb: "#8A9691",
  handleBar: colors.line,
  segmentActiveBg: colors.white,
  segmentActiveBorder: colors.line,
  scrim: "rgba(30,43,39,0.35)",
};

// Dark is a supported secondary mode, anchored on ink: every filled surface (screen,
// sheet, card) IS ink, and structure comes from hairlines rather than from stacked
// lighter surfaces. Ink's hue is a desaturated green, so *lifting* it to separate a
// surface reads as dark green — the brighter the lift, the greener it looks. Where a
// control genuinely needs to sit apart (an input track), it recesses BELOW ink
// instead of lifting above it, which keeps the whole screen on-token.
export const darkTheme: Theme = {
  bg: colors.ink,
  bgAlt: colors.ink,
  bgInput: "#0E1210", // recessed below ink, not lifted above it
  card: colors.ink,
  cardBorder: "#2C3633",
  text: colors.paper,
  textMuted: "#8B9B96", // slate, lightened to stay legible on ink
  textSubtle: colors.slate,
  textBody: "#D9DEDB",
  primary: colors.sproutDeep,
  primaryText: colors.white,
  secondaryBg: "rgba(57,179,120,0.14)",
  secondaryText: colors.sprout,
  navBg: colors.ink,
  navBorder: "#2C3633",
  toggleTrack: "#2C3633",
  toggleThumb: "#8B9B96",
  handleBar: "#333D3A",
  segmentActiveBg: colors.ink, // raised back to ink out of the recessed track
  segmentActiveBorder: "#374340",
  scrim: "rgba(0,0,0,0.55)",
};

// Accent used for active/selected affordances (tab bar, segment labels), as
// distinct from `primary`, which is reserved for button fills.
export const accent: Record<ThemeName, string> = {
  light: colors.sproutDeep,
  dark: colors.sprout,
};

export const THEMES: Record<ThemeName, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};

type ThemeContextValue = {
  /** The resolved theme in effect. With preference "system" this tracks the OS. */
  name: ThemeName;
  theme: Theme;
  /** What the user picked — "system" stays "system" here even once resolved. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

/**
 * Resolve a preference against the OS scheme. `useColorScheme()` can report null or
 * "unspecified" as well as light/dark, so anything that isn't explicitly "dark" falls
 * back to light — the brand's primary mode — rather than flashing dark.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemScheme: ColorSchemeName,
): ThemeName {
  if (preference !== "system") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
