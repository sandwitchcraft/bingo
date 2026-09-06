import { createContext, useContext } from "react";
import type { ColorSchemeName, TextStyle } from "react-native";

import { BIN_ORDER, type BinType } from "@/core/bins";
import {
  BIN_ROLE,
  binSwatches,
  fonts,
  iconStroke,
  lid,
  logo,
  modes,
  palette,
  radii,
  scanSurface,
  spacing,
  type BinSwatch,
} from "@/ui/brand";

// Brand tokens are re-exported here so components have a single import site for anything
// visual (`@/ui/theme`). brand.ts mirrors docs/design/branding/theme.ts and is the source of
// truth for raw token values — change tokens there, not here.
export { iconStroke, lid, logo, palette, radii, scanSurface, spacing };
export type { BinSwatch };

// Font families as registered by expo-font (see the root layout). Each family has exactly
// one job: Bricolage for display/titles/button labels, Hanken for all prose and rows, IBM
// Plex Mono for anything sourced from a rulebook (stamps, eyebrows, dates).
export const FONT = {
  display: fonts.display.fontFamily,
  heading: fonts.heading.fontFamily,
  body: fonts.body.fontFamily,
  bodyEmphasis: fonts.bodyEmphasis.fontFamily,
  bodyStrong: fonts.bodyStrong.fontFamily,
  utility: fonts.utility.fontFamily,
} as const;

/**
 * The type scale from the sheet, as ready-to-spread text styles. RN's `letterSpacing` is in
 * points, so the sheet's em tracking is pre-multiplied by the size here. Display is always
 * Bricolage and always negatively tracked; mono is always uppercase and tracked out.
 */
export const TYPE = {
  /** Bricolage 700 / 50 — the one-word answer. */
  answer: { fontFamily: FONT.display, fontSize: 50, lineHeight: 50, letterSpacing: -1.75 },
  /** Bricolage 700 / 36 — section titles. */
  h1: { fontFamily: FONT.display, fontSize: 36, lineHeight: 38, letterSpacing: -0.9 },
  /** Bricolage 700 / 32 — screen titles. */
  h2: { fontFamily: FONT.display, fontSize: 32, lineHeight: 34, letterSpacing: -0.96 },
  /** Bricolage 600 / 26 — the item you asked about. */
  h3: { fontFamily: FONT.heading, fontSize: 26, lineHeight: 28, letterSpacing: -0.52 },
  /** Bricolage 600 / 19 — card headlines ("Looks like"). */
  h4: { fontFamily: FONT.heading, fontSize: 19, lineHeight: 22, letterSpacing: -0.38 },
  /** Bricolage 600 / 17 — list titles, place names, large button labels. */
  title: { fontFamily: FONT.heading, fontSize: 17, lineHeight: 20, letterSpacing: -0.26 },
  /** Bricolage 600 / 15 — button labels. */
  button: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 18, letterSpacing: -0.15 },
  /** Bricolage 600 / 13 — the bin label at the end of a row. */
  rowBin: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 16 },
  /** Hanken 400 / 19 — lead paragraph. */
  lead: { fontFamily: FONT.body, fontSize: 19, lineHeight: 28 },
  /** Hanken 400 / 16 — body. */
  body: { fontFamily: FONT.body, fontSize: 16, lineHeight: 24 },
  /** Hanken 400 / 15 — dense body (the answer card's local line). */
  bodySm: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22 },
  /** Hanken 400 / 14 — notes. */
  note: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21 },
  /** Hanken 500 / 15 — item rows. */
  row: { fontFamily: FONT.bodyEmphasis, fontSize: 15, lineHeight: 20 },
  /** Hanken 400 / 13 — meta lines, hints. */
  small: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  /** Hanken 600 / 13 — the location chip label. */
  chip: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 16 },
  /** Hanken 600 / 12 — tag chips ("Certain"). */
  tag: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 14 },
  /** Plex Mono 400 / 12 — section eyebrows. */
  eyebrow: {
    fontFamily: FONT.utility,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  /** Plex Mono 400 / 11 — provenance stamps. */
  stamp: {
    fontFamily: FONT.utility,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  /** Plex Mono 400 / 10 — micro eyebrows inside cards. */
  micro: {
    fontFamily: FONT.utility,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  /** Plex Mono 400 / 10, not uppercased — hex codes, timestamps. */
  mono: { fontFamily: FONT.utility, fontSize: 10, lineHeight: 13 },
} as const satisfies Record<string, TextStyle>;

/** A resolved, concrete theme — always one of two real palettes. */
export type ThemeName = "dark" | "light";

/**
 * What the user chose. "system" is a *preference*, not a theme: it resolves to a
 * ThemeName at render time from the OS scheme. Keeping the two types distinct means
 * nothing downstream can accidentally try to look up a palette called "system".
 */
export type ThemePreference = ThemeName | "system";

export type Theme = {
  /** Page ground. */
  bg: string;
  /** The darker sand — secondary chips, segment tracks, pressed fills, the Places screen. */
  surface: string;
  /** Raised cards, sheets, inputs sitting on the ground. */
  card: string;
  /** A recessed field or row inside a card. */
  card2: string;
  text: string;
  text2: string;
  /** 1px hairline — every container edge. */
  line: string;
  /** Heavier hairline — inputs, secondary buttons. */
  lineStrong: string;
  /** Green: every button, toggle, active state and confirmation. */
  accent: string;
  /** One step further along the ramp — hover/pressed, ghost-button text. */
  accentStrong: string;
  /** Soft green fill for chips, the rationale note, the active place row. */
  accentTint: string;
  /** Ink on `accentTint`. */
  accentInk: string;
  /** Ink on `accent`. */
  onAccent: string;
  scrim: string;
  shadow: string;
  /** Per-bin swatches for this lightness. Always resolve bin colour through here. */
  bins: Record<BinType, BinSwatch>;
};

function binsFor(mode: ThemeName): Record<BinType, BinSwatch> {
  const out = {} as Record<BinType, BinSwatch>;
  for (const bin of BIN_ORDER) out[bin] = binSwatches[mode][BIN_ROLE[bin]];
  return out;
}

// Light is the default. Every value maps to a named token in brand.ts; only `scrim` is
// derived here (the sheet has no modal scrim — it's warm ink at low alpha).
export const lightTheme: Theme = {
  ...modes.light,
  scrim: "rgba(33,31,26,0.35)",
  bins: binsFor("light"),
};

// Dark is the same palette warmed and lifted, not inverted: the cream darkens into umber,
// and every bin fill rises to its lighter step so the answer card takes dark ink.
export const darkTheme: Theme = {
  ...modes.dark,
  scrim: "rgba(0,0,0,0.55)",
  bins: binsFor("dark"),
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
