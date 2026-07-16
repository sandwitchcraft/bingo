import { createContext, useContext } from "react";

// Font families as registered by expo-font (see loadFonts in the root layout).
// The whole app uses DM Sans; weights map to these family names.
export const FONT = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
} as const;

export type ThemeName = "dark" | "light";

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
  navBg: string;
  navBorder: string;
  toggleTrack: string;
  toggleThumb: string;
  handleBar: string;
  segmentActiveBg: string;
  segmentActiveBorder: string;
  scrim: string;
};

// Transcribed verbatim from docs/SortScan-UI-Spec.txt color tables.
export const darkTheme: Theme = {
  bg: "#0a1209",
  bgAlt: "#0d1a0f",
  bgInput: "#141f15",
  card: "#0d1a0f",
  cardBorder: "#1f3322",
  text: "#e8f5e9",
  textMuted: "#3d5c42",
  textSubtle: "#2a4a2e",
  textBody: "#c8e6c9",
  primary: "#4ade80",
  primaryText: "#052e16",
  navBg: "#0a1209",
  navBorder: "#1f3322",
  toggleTrack: "#1f3322",
  toggleThumb: "#3d5c42",
  handleBar: "#2a4a2e",
  segmentActiveBg: "#1a3320",
  segmentActiveBorder: "#2a5c35",
  scrim: "rgba(0,0,0,0.75)",
};

export const lightTheme: Theme = {
  bg: "#f2f7f2",
  bgAlt: "#ffffff",
  bgInput: "#e8f2e8",
  card: "#ffffff",
  cardBorder: "#cce0cc",
  text: "#0d1a0f",
  textMuted: "#5c7a60",
  textSubtle: "#8aaa8e",
  textBody: "#2d4a30",
  primary: "#16a34a",
  primaryText: "#ffffff",
  navBg: "#f2f7f2",
  navBorder: "#cce0cc",
  toggleTrack: "#cce0cc",
  toggleThumb: "#8aaa8e",
  handleBar: "#cce0cc",
  segmentActiveBg: "#d4edd4",
  segmentActiveBorder: "#a3c9a3",
  scrim: "rgba(0,0,0,0.4)",
};

export const THEMES: Record<ThemeName, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};

type ThemeContextValue = {
  name: ThemeName;
  theme: Theme;
  setThemeName: (name: ThemeName) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
