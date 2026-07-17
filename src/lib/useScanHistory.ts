import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";

import type { BinType } from "@/lib/bins";
import { getBinCounts, listRecentScans, type ScanHistoryRow } from "@/lib/db";

type ScanHistoryData = {
  scans: ScanHistoryRow[];
  counts: Record<BinType, number>;
};

/**
 * Reads scan history, refetching whenever the screen regains focus.
 *
 * Focus is the right trigger rather than a mount effect (tabs stay mounted, so it
 * would only ever run once) or expo-sqlite's change listener (global across
 * databases, and fires once per row, so clearing history would storm it). Scans are
 * the only writer and can't happen while history is on screen, so by the time a new
 * row matters, this screen is being focused.
 */
export function useScanHistory(limit = 50) {
  const db = useSQLiteContext();
  const [data, setData] = useState<ScanHistoryData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    // One round trip; expo-sqlite serializes these on its own thread anyway.
    const [scans, counts] = await Promise.all([listRecentScans(db, limit), getBinCounts(db)]);
    setData({ scans, counts });
    setError(null);
  }, [db, limit]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      refresh().catch((e: unknown) => {
        if (!cancelled) setError(e as Error);
      });
      return () => {
        cancelled = true;
      };
    }, [refresh]),
  );

  return {
    data,
    error,
    refresh,
    // Distinct from "loaded but empty", so callers don't flash an empty state
    // before the first query comes back.
    loading: data === null && error === null,
  };
}
