// Bin-go design system — theme constants
// Source of truth: design-tokens.json. Keep both in sync if either changes.
//
// Fonts: load via expo-font before use.
//   Manrope: Manrope_700Bold, Manrope_800ExtraBold  (@expo-google-fonts/manrope)
//   Inter: Inter_400Regular, Inter_600SemiBold        (@expo-google-fonts/inter)
//   IBM Plex Mono: IBMPlexMono_500Medium, IBMPlexMono_600SemiBold (@expo-google-fonts/ibm-plex-mono)

export const colors = {
  sprout: "#39B378",      // primary accent — CTAs, links, logo dot
  sproutDeep: "#218A5A",  // primary button background + organics bin indicator
  harbor: "#3E8BD6",      // recycling bin indicator ONLY — do not use as general accent
  clay: "#D77930",        // garbage indicator ONLY (deepened from #DB7B31 for AA on paper)
  alert: "#C4362B",       // error notifications ONLY — never a bin indicator, never an accent
  ink: "#141A18",         // dark mode surface / light mode text
  slate: "#5B6B66",       // secondary text, captions, metadata
  paper: "#FAFAF8",       // light mode background
  line: "#E7E5DE",        // borders, dividers
  white: "#FFFFFF",
} as const;

// Bin outcome → color mapping. Use this, not a hardcoded switch, wherever
// a bin result needs a color (result screen, history list, pictogram badges).
export const binColors = {
  recycling: colors.harbor,
  organics: colors.sproutDeep,
  garbage: colors.clay,
  // Consult reads slate, not clay: it isn't a disposal outcome like the other three,
  // it's a deferral, so it stays neutral rather than sharing garbage's indicator.
  "check-local-guide": colors.slate,
} as const;

export const fonts = {
  display: { fontFamily: "Manrope_800ExtraBold" },   // item names, hero headings
  heading: { fontFamily: "Manrope_700Bold" },        // section/screen titles
  body: { fontFamily: "Inter_400Regular" },          // paragraphs, instructions
  bodyEmphasis: { fontFamily: "Inter_600SemiBold" }, // inline emphasis only
  utility: { fontFamily: "IBMPlexMono_500Medium" },        // ALL labels, eyebrows, metadata, timestamps
  utilityStrong: { fontFamily: "IBMPlexMono_600SemiBold" },
} as const;

export const radii = {
  button: 999,   // full pill
  card: 18,
  iconBadge: 999, // circular at fixed width/height
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Component-level presets — use these directly rather than re-deriving
// button/card styles per screen, so the app stays visually consistent.
export const components = {
  buttonPrimary: {
    backgroundColor: colors.sproutDeep,
    color: colors.white,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  buttonSecondary: {
    backgroundColor: "rgba(57,179,120,0.10)",
    color: colors.sproutDeep,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderWidth: 0,
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: 18,
  },
  pictogramBadge: {
    width: 56,
    height: 56,
    borderRadius: 999,
    // backgroundColor should be the relevant binColors value at ~14-16% opacity,
    // e.g. `${binColors.recycling}24` (hex alpha suffix) — tint matches bin OUTCOME,
    // not a fixed "material" color.
  },
} as const;

// Logo lockup — enforced as a rule, not just a style, since this was explicitly
// finalized: lowercase only, dot always sprout-colored, no other casing/separator.
export const logo = {
  wordmark: "bin·go",
  dotColor: colors.sprout,
  rule: "Lowercase only. Middle-dot separator, always sproutColor. No title case, no hyphen, no icon mark.",
} as const;

// Voice rules for any user-facing copy this agent generates.
export const voice = {
  tone: "instructional, direct, no exclamation points, no filler enthusiasm",
  examples: {
    good: ["Rinse before disposal.", "Item not recognized. Try a clearer angle.", "Scanned. Saved to history."],
    avoid: ["Give it a quick rinse first!", "Oops, we couldn't recognize that.", "Great job scanning your first item!"],
  },
} as const;

export const theme = { colors, binColors, fonts, radii, spacing, components, logo, voice } as const;
export default theme;
