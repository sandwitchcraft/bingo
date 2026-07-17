import type { SQLiteDatabase } from "expo-sqlite";

import { insertScanAt } from "@/lib/db";
import { getBinForItem, getItemKeys, getRegionName } from "@/lib/regionData";

/**
 * Days before today for each seeded scan, oldest first. Fixed rather than random so
 * the seed is reproducible, and deliberately clustered at the near end: today and
 * yesterday exercise History's "time only" vs "date · time" split, and the long tail
 * gives the date formatting something to actually show.
 */
const DAYS_AGO = [60, 45, 38, 30, 25, 21, 18, 14, 12, 10, 8, 7, 5, 4, 3, 2, 1, 1, 0, 0];

/**
 * Fills scan history with backdated scans for testing date rendering. Dev-only, and
 * additive — run it twice and you get two sets. Clear history in Settings to reset.
 *
 * Rows are inserted oldest first because list queries order by `id`, not `scanned_at`
 * (see `listRecentScans`) — inserting them in any other order would put the seeded
 * dates out of order on screen and look like a formatting bug.
 */
export async function seedScanHistory(db: SQLiteDatabase): Promise<number> {
  const itemKeys = getItemKeys();
  const region = getRegionName();
  const now = new Date();

  let inserted = 0;
  for (const [index, daysAgo] of DAYS_AGO.entries()) {
    const itemKey = itemKeys[index % itemKeys.length];
    const result = getBinForItem(itemKey);
    if (!result) continue;

    // Time of day comes from the row's position *within its own day*, so rows
    // sharing a day always step forward (10:00, then 14:00). Deriving the hour from
    // `index` instead would let a later row land earlier in the day, which reads as
    // a sort bug on screen. Minutes step by a prime just to look unscripted.
    const sameDayIndex = DAYS_AGO.slice(0, index).filter((d) => d === daysAgo).length;
    const scannedAt = new Date(now);
    scannedAt.setDate(scannedAt.getDate() - daysAgo);
    scannedAt.setHours(10 + sameDayIndex * 4, (index * 17) % 60, 0, 0);
    // A fixed hour on a day still in progress can land in the future — pull those
    // back to just-now, still in index order, so today's rows read as scans that
    // already happened.
    if (scannedAt > now) {
      scannedAt.setTime(now.getTime() - (DAYS_AGO.length - index) * 60_000);
    }

    await insertScanAt(db, { itemKey, bin: result.bin, region, scannedAt });
    inserted += 1;
  }
  return inserted;
}
