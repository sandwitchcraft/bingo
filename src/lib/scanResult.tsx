import { useSQLiteContext } from "expo-sqlite";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { insertScan } from "@/lib/db";
import { getBinForItem, getRegionName } from "@/lib/regionData";

type ScanResultContextValue = {
  activeItemKey: string | null;
  showResult: (itemKey: string) => void;
  dismiss: () => void;
};

const ScanResultContext = createContext<ScanResultContextValue | null>(null);

export function ScanResultProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);

  const value = useMemo<ScanResultContextValue>(
    () => ({
      activeItemKey,
      // History is recorded here rather than in an effect on activeItemKey: scanning
      // the same item twice sets identical state, which wouldn't re-run an effect and
      // would silently lose the second scan. One showResult call is one row.
      showResult: (itemKey: string) => {
        setActiveItemKey(itemKey);

        const result = getBinForItem(itemKey);
        // The sheet renders nothing for an unknown key, so there's no outcome to log.
        if (!result) return;

        // Fire-and-forget: a failed write must never block or interrupt showing the
        // result. The catch isn't optional — an unhandled rejection redboxes in dev.
        insertScan(db, { itemKey, bin: result.bin, region: getRegionName() }).catch(
          (error) => {
            console.warn("[history] failed to record scan", error);
          },
        );
      },
      dismiss: () => setActiveItemKey(null),
    }),
    [activeItemKey, db],
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
