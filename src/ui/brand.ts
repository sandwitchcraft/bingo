// bin·go design system — raw tokens.
// Source of truth: the approved "bin-go Color and Type v3" sheet (claude.ai/design),
// mirrored at docs/design/branding/design-tokens.json and docs/design/branding/theme.ts.
// Keep the three in sync if any of them changes.
//
// One warm palette at two lightnesses. The ground is cream with warm ink; dark mode is
// warm umber with sand ink — the cream darkens without ever cooling into grey. Green does
// double duty: it is the app accent (buttons, toggles, active states, confirmations) AND
// the organics lid. Blue, black and amber only ever appear as an answer, so a colour on
// screen always means a bin.
//
// Fonts: load via expo-font before use (see src/app/_layout.tsx).
//   Bricolage Grotesque: BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold
//   Hanken Grotesk:      HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold
//   IBM Plex Mono:       IBMPlexMono_400Regular

import type { BinType } from "@/core/bins";

/** Base ramps. Components never read these directly — go through `modes` / `binSwatches`. */
export const palette = {
  // ground — light
  cream50: "#FBF5E9",
  cream100: "#F5EAD8",
  cream200: "#EBDDC5",
  ink900: "#211F1A",
  ink600: "#5C574C",

  // ground — dark
  umber900: "#16140F",
  umber800: "#191712",
  umber700: "#211D17",
  umber600: "#241F18",
  sand100: "#F4ECDC",
  sand300: "#B0A795",

  // green ramp — the accent
  green50: "#EEF4EA",
  green100: "#DFEADB",
  green200: "#BCD6BF",
  green300: "#7CB18F",
  green400: "#6FB98A",
  green500: "#34794F",
  green600: "#23593A",
  green700: "#1B4A2F",
  green800: "#143220",
  green900: "#12281A",
  // dark-mode accent steps (lifted so the accent reads on umber)
  greenDarkAccent: "#7CC294",
  greenDarkAccentStrong: "#A3D7B3",
  greenDarkTint: "#23372A",
  greenDarkTintInk: "#B7DCC3",

  // bin hues — answer only
  blue500: "#3C6693",
  blue300: "#7FA5CC",
  blue100: "#DEE6EF",
  blue700: "#22405F",
  blue900: "#12202E",
  blueDarkTint: "#24303D",
  blueDarkTintInk: "#BCD2E6",

  black500: "#2B2823",
  black300: "#3A352D",
  black100: "#DDD8CD",
  black200: "#2C2823",
  black050: "#D8CFBE",
  blackDarkInk: "#F0E7D6",

  amber500: "#A9701F",
  amber400: "#D99F4E",
  amber100: "#F4E6CF",
  amber700: "#6E4611",
  amber900: "#2A1C07",
  amber200: "#3A2F1D",
  amber300: "#ECC98D",

  /** Ink on the light accent and on light bin fills. */
  onAccentLight: "#F7F2E6",

  /**
   * Errors only — the toast banner's fill and the swipe-to-remove action. The sheet has no
   * red; this is a warm brick chosen to sit in the palette without being any bin's colour.
   * Amber is a bin (take-back / consult), so an error must never borrow it.
   */
  alert: "#B5432B",
} as const;

/** The semantic aliases per mode — exactly the `[data-mode]` variables on the design sheet. */
export const modes = {
  light: {
    bg: palette.cream100,
    surface: palette.cream200,
    card: palette.cream50,
    card2: palette.cream100,
    text: palette.ink900,
    text2: palette.ink600,
    line: "rgba(33,31,26,0.16)",
    lineStrong: "rgba(33,31,26,0.26)",
    accent: palette.green500,
    accentStrong: palette.green600,
    accentTint: palette.green100,
    accentInk: palette.green700,
    onAccent: palette.onAccentLight,
    shadow: "rgba(46,43,37,0.18)",
  },
  dark: {
    bg: palette.umber800,
    surface: palette.umber600,
    card: palette.umber700,
    card2: palette.umber900,
    text: palette.sand100,
    text2: palette.sand300,
    line: "rgba(244,236,220,0.16)",
    lineStrong: "rgba(244,236,220,0.30)",
    accent: palette.greenDarkAccent,
    accentStrong: palette.greenDarkAccentStrong,
    accentTint: palette.greenDarkTint,
    accentInk: palette.greenDarkTintInk,
    onAccent: palette.green900,
    shadow: "rgba(0,0,0,0.5)",
  },
} as const;

/**
 * A bin's four colours: the full-strength `fill` with the `ink` that sits on it (the answer
 * card, a lid bar), and the `tint` with its `tintInk` (chips, rationale notes, list labels).
 * In dark mode every fill lifts to its lighter step so the answer card takes dark ink.
 */
export type BinSwatch = { fill: string; ink: string; tint: string; tintInk: string };

/** The four lid roles on the sheet. `BinType` maps onto these via `BIN_ROLE`. */
export type BinRole = "green" | "blue" | "black" | "amber";

/**
 * bingoDB's bins → the sheet's lid roles. Green is organics (and the accent); blue is
 * recycling; black is garbage. Amber is the sheet's "take-back / answer + caution" role —
 * batteries, bulbs, depot glass — which is exactly what consult-local-guide covers, so the
 * deferral carries a real colour instead of reading as grey.
 */
export const BIN_ROLE: Record<BinType, BinRole> = {
  compost: "green",
  recycling: "blue",
  garbage: "black",
  "consult-local-guide": "amber",
};

export const binSwatches: Record<"light" | "dark", Record<BinRole, BinSwatch>> = {
  light: {
    green: {
      fill: palette.green500,
      ink: palette.onAccentLight,
      tint: palette.green100,
      tintInk: palette.green700,
    },
    blue: {
      fill: palette.blue500,
      ink: palette.onAccentLight,
      tint: palette.blue100,
      tintInk: palette.blue700,
    },
    black: {
      fill: palette.black500,
      ink: palette.onAccentLight,
      tint: palette.black100,
      tintInk: palette.black500,
    },
    amber: {
      fill: palette.amber500,
      ink: palette.cream50,
      tint: palette.amber100,
      tintInk: palette.amber700,
    },
  },
  dark: {
    green: {
      fill: palette.green400,
      ink: palette.green900,
      tint: palette.greenDarkTint,
      tintInk: palette.greenDarkTintInk,
    },
    blue: {
      fill: palette.blue300,
      ink: palette.blue900,
      tint: palette.blueDarkTint,
      tintInk: palette.blueDarkTintInk,
    },
    black: {
      fill: palette.black300,
      ink: palette.blackDarkInk,
      tint: palette.black200,
      tintInk: palette.black050,
    },
    amber: {
      fill: palette.amber400,
      ink: palette.amber900,
      tint: palette.amber200,
      tintInk: palette.amber300,
    },
  },
};

/**
 * The scan screen is the one permanently dark surface in the product, in both themes. These
 * are the dark-mode tokens it uses regardless of the active theme, plus the two overlays the
 * sheet allows over a dark ground.
 */
export const scanSurface = {
  bg: palette.umber900,
  text: palette.sand100,
  text2: palette.sand300,
  card: palette.cream50,
  cardText: palette.ink900,
  cardText2: palette.ink600,
  reticle: palette.greenDarkAccent,
  shutter: palette.greenDarkAccent,
  shutterPressed: palette.greenDarkAccentStrong,
  shutterRing: palette.cream50,
  chip: "rgba(244,236,220,0.14)",
  chipPressed: "rgba(244,236,220,0.26)",
  /** The viewfinder stand-in stripe pair, for the no-camera (web) state. */
  stripeA: "#24211A",
  stripeB: "#1C1915",
} as const;

// Three faces, each with one job. Bricolage states it (display, titles, button labels),
// Hanken explains it (all prose, rows, chips), Plex Mono sources it (anything quoted from a
// rulebook: provenance stamps, dates, eyebrows). Body copy is never mono; display type is
// never anything but Bricolage.
export const fonts = {
  display: { fontFamily: "BricolageGrotesque_700Bold" }, // the answer, screen titles
  heading: { fontFamily: "BricolageGrotesque_600SemiBold" }, // list titles, button labels
  body: { fontFamily: "HankenGrotesk_400Regular" }, // prose, rules
  bodyEmphasis: { fontFamily: "HankenGrotesk_500Medium" }, // item rows, place names
  bodyStrong: { fontFamily: "HankenGrotesk_600SemiBold" }, // chips, location labels
  utility: { fontFamily: "IBMPlexMono_400Regular" }, // stamps, eyebrows, sourced data
} as const;

// Over-rounded: containers 18–28, phone screens 34, every button and chip a full pill.
// Never a sharp corner.
export const radii = {
  chip: 999, // every button, chip, input
  sm: 12,
  md: 18, // list rows, notes
  lg: 24, // cards, place rows
  xl: 28, // the answer card
  screen: 34,
  /** Kept for callers that size a circular badge at fixed width/height. */
  iconBadge: 999,
} as const;

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 26,
  s8: 34,
  s10: 48,
  s12: 68,
} as const;

/**
 * The lid motif — a bin drawn as a rounded vertical bar in its lid colour. A row of them
 * describes a region's bin set. This is the only illustration in the system: no bin drawings,
 * no icons of trash, no mascots.
 */
export const lid = {
  width: 10,
  height: 24,
  radius: 3,
  /** Row-sized variant (place rows, region card). */
  stackWidth: 8,
  stackHeight: 32,
  stackGap: 3,
} as const;

/** Lucide-style functional glyphs: stroke 2.4, `currentColor`, 14–20px. */
export const iconStroke = 2.4;

// Logo lockup — enforced as a rule, not just a style: lowercase, interpunct in accent
// green, Bricolage 700 tracked −0.03em. No mark, no other casing or separator.
export const logo = {
  wordmark: "bin·go",
  rule: "Lowercase only. Middle-dot separator, always the accent green. No title case, no hyphen, no icon mark.",
} as const;

// Voice rules for any user-facing copy: calm, second-person, specific. Order is fixed —
// bin, then reason, then exception. Sentence case everywhere; uppercase only in mono stamps.
export const voice = {
  tone: "calm, second-person, specific; bin → reason → exception; no exclamation marks, no emoji, no hedging",
  examples: {
    good: [
      "Green bin. Greasy card can't be recycled here.",
      "Black bin. There is no household organics collection on this street.",
      "Item not recognized. Try a clearer angle.",
    ],
    avoid: ["Oops! That's a tricky one 🤔", "Give it a quick rinse first!", "We think this is probably recycling."],
  },
} as const;

export const theme = {
  palette,
  modes,
  binSwatches,
  BIN_ROLE,
  scanSurface,
  fonts,
  radii,
  spacing,
  lid,
  iconStroke,
  logo,
  voice,
} as const;
export default theme;
