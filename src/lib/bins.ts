export type BinType = "recycling" | "compost" | "garbage" | "consult_local_guide";

type BinStyle = {
  label: string;
  emoji: string;
  // Dark-mode bin colors (fixed / theme-independent per spec).
  dark: { text: string; bg: string; border: string };
  // Light-mode History-badge adaptation.
  light: { bg: string; text: string; dot: string };
};

// Compost / recycling / garbage values transcribed from the spec's BIN COLOR SYSTEM.
// consult_local_guide is a 4th, amber style extending the spec (for batteries, e-waste, etc.).
export const BIN_STYLE: Record<BinType, BinStyle> = {
  compost: {
    label: "Compost",
    emoji: "🌱",
    dark: { text: "#86efac", bg: "#052e16", border: "#166534" },
    light: { bg: "#f0fdf4", text: "#166534", dot: "#16a34a" },
  },
  recycling: {
    label: "Recycling",
    emoji: "♻️",
    dark: { text: "#93c5fd", bg: "#0c1a2e", border: "#1e3a5f" },
    light: { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  },
  garbage: {
    label: "Garbage",
    emoji: "🗑️",
    dark: { text: "#fca5a5", bg: "#2d0a0a", border: "#7f1d1d" },
    light: { bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  },
  consult_local_guide: {
    label: "Consult Guide",
    emoji: "ℹ️",
    dark: { text: "#fcd34d", bg: "#2e2205", border: "#7f5f1d" },
    light: { bg: "#fffbeb", text: "#92610b", dot: "#d97706" },
  },
};
