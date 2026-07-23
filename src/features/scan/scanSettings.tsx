import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * How the Scan screen drives inference.
 * - `continuous`: auto-scan. The model runs on the frame stream (every Nth frame), the
 *   detected item updates live, and it commits on its own once a detection clears the
 *   auto-scan confidence threshold — no button.
 * - `tap`: the model runs only when you tap, so the preview stays fully smooth between
 *   scans. Lighter on the frame thread — the more responsive option on slower devices.
 */
export type ScanMode = "continuous" | "tap";

type ScanSettingsValue = {
  scanMode: ScanMode;
  setScanMode: (mode: ScanMode) => void;
};

const ScanSettingsContext = createContext<ScanSettingsValue | null>(null);

export function ScanSettingsProvider({ children }: { children: ReactNode }) {
  // In-memory like the theme preference (see ThemeProvider) — not persisted to storage yet.
  const [scanMode, setScanMode] = useState<ScanMode>("continuous");
  const value = useMemo(() => ({ scanMode, setScanMode }), [scanMode]);
  return <ScanSettingsContext.Provider value={value}>{children}</ScanSettingsContext.Provider>;
}

export function useScanSettings(): ScanSettingsValue {
  const ctx = useContext(ScanSettingsContext);
  if (!ctx) {
    throw new Error("useScanSettings must be used within a ScanSettingsProvider");
  }
  return ctx;
}
