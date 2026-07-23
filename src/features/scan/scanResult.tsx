import { useSQLiteContext } from "expo-sqlite";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { insertScan } from "@/features/history/db";
import { getRegionName, resolveScanResult } from "@/features/region/regionData";
import { useRegionRules } from "@/features/region/regionStore";

type ScanResultContextValue = {
  activeItemKey: string | null;
  showResult: (itemKey: string) => void;
  dismiss: () => void;
};

const ScanResultContext = createContext<ScanResultContextValue | null>(null);

export function ScanResultProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const rules = useRegionRules();
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);

  const value = useMemo<ScanResultContextValue>(
    () => ({
      activeItemKey,
      // History is recorded here rather than in an effect on activeItemKey: scanning
      // the same item twice sets identical state, which wouldn't re-run an effect and
      // would silently lose the second scan. One showResult call is one row.
      showResult: (itemKey: string) => {
        setActiveItemKey(itemKey);

        // resolveScanResult always returns a result (real rule, or the consult-local-guide
        // fallback for a recognized-but-unlisted object), so every scan logs a row.
        const result = resolveScanResult(rules, itemKey);

        // Fire-and-forget: a failed write must never block or interrupt showing the
        // result. The catch isn't optional — an unhandled rejection redboxes in dev.
        insertScan(db, { itemKey, bin: result.bin, region: getRegionName(rules) }).catch(
          (error) => {
            console.warn("[history] failed to record scan", error);
          },
        );
      },
      dismiss: () => setActiveItemKey(null),
    }),
    [activeItemKey, db, rules],
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
