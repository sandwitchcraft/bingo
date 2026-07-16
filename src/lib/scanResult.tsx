import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ScanResultContextValue = {
  activeItemKey: string | null;
  showResult: (itemKey: string) => void;
  dismiss: () => void;
};

const ScanResultContext = createContext<ScanResultContextValue | null>(null);

export function ScanResultProvider({ children }: { children: ReactNode }) {
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);

  const value = useMemo<ScanResultContextValue>(
    () => ({
      activeItemKey,
      showResult: (itemKey: string) => setActiveItemKey(itemKey),
      dismiss: () => setActiveItemKey(null),
    }),
    [activeItemKey],
  );

  return <ScanResultContext.Provider value={value}>{children}</ScanResultContext.Provider>;
}

export function useScanResult(): ScanResultContextValue {
  const ctx = useContext(ScanResultContext);
  if (!ctx) {
    throw new Error("useScanResult must be used within a ScanResultProvider");
  }
  return ctx;
}
