/**
 * Scan history storage: the SQLite schema, its migrations, and every query run against it.
 * React-free — `SQLiteProvider` is mounted in `src/app/_layout.tsx` and `useScanHistory.ts`
 * is the hook that reads through this.
 *
 * Two schema facts worth knowing before using anything here:
 * - `item_name` stores the raw item **key** (`"plastic_bottle"`), not a display name, so it
 *   stays a valid join key back into the region rules. Render it via `formatItemName`.
 * - `scanned_at` is UTC at one-second resolution — too coarse to order by, so list queries
 *   order by `id` (AUTOINCREMENT, append-only) instead. Parse it with `parseScannedAt`.
 *
 * `migrateDbAsync` is versioned through `PRAGMA user_version`. Earlier versions rewrote bin
 * names on existing rows as the vocabulary churned (`compost`↔`organics`,
 * `check-local-guide`→`consult-local-guide`); those were collapsed away on 2026-07-23 once the
 * only device that ran them was reset, so version 1 is now the whole schema. Reintroduce the
 * versioned chain before this ships to a second device — migrations are append-only there.
 */
import type { SQLiteDatabase, SQLiteOpenOptions } from "expo-sqlite";

import type { BinType } from "@/core/bins";

export const DATABASE_NAME = "bingo.db";

// Module-level on purpose: SQLiteProvider compares `options` and `onInit` by
// reference, so an inline object at the call site would close and reopen the
// connection on every root re-render.
export const DATABASE_OPTIONS: SQLiteOpenOptions = {};

const LATEST_VERSION = 1;

export async function migrateDbAsync(db: SQLiteDatabase): Promise<void> {
  // journal_mode can't change inside a transaction, so it runs first. It persists
  // in the file; re-running it on later launches is a no-op.
  await db.execAsync("PRAGMA journal_mode = WAL;");

  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  if (version >= LATEST_VERSION) return;

  await db.withTransactionAsync(async () => {
    if (version === 0) {
      await db.execAsync(`
        CREATE TABLE scan_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_name TEXT,
          bin_result TEXT,
          region TEXT,
          scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      version = 1;
    }
    // PRAGMA can't be parameterized. `version` is derived from this module's own
    // constants and never from input.
    await db.execAsync(`PRAGMA user_version = ${version}`);
  });
}

export type ScanHistoryRow = {
  id: number;
  /**
   * The raw item key ("plastic_bottle"), not a display name — despite the column
   * name, which is fixed by the schema in CLAUDE.md. Render it through
   * `formatItemName`, and look up current rules with `getBinForItem`.
   */
  item_name: string;
  bin_result: BinType;
  region: string;
  /** "YYYY-MM-DD HH:MM:SS" in UTC. Parse with `parseScannedAt`. */
  scanned_at: string;
};

export async function insertScan(
  db: SQLiteDatabase,
  scan: { itemKey: string; bin: BinType; region: string },
): Promise<number> {
  const result = await db.runAsync(
    "INSERT INTO scan_history (item_name, bin_result, region) VALUES (?, ?, ?)",
    scan.itemKey,
    scan.bin,
    scan.region,
  );
  return result.lastInsertRowId;
}

/**
 * Same as `insertScan` but with an explicit timestamp, for backdating rows that
 * didn't happen now — currently only the dev seed in `devSeed.ts`. Real scans go
 * through `insertScan` and let SQLite stamp them.
 */
export async function insertScanAt(
  db: SQLiteDatabase,
  scan: { itemKey: string; bin: BinType; region: string; scannedAt: Date },
): Promise<number> {
  const result = await db.runAsync(
    "INSERT INTO scan_history (item_name, bin_result, region, scanned_at) VALUES (?, ?, ?, ?)",
    scan.itemKey,
    scan.bin,
    scan.region,
    formatScannedAt(scan.scannedAt),
  );
  return result.lastInsertRowId;
}

/** Inverse of `parseScannedAt`: CURRENT_TIMESTAMP's exact "YYYY-MM-DD HH:MM:SS" UTC shape. */
function formatScannedAt(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Newest first. Ordered by id rather than scanned_at: rows are append-only with an
 * AUTOINCREMENT id, so id order *is* insertion order, it rides the primary key
 * index, and it doesn't tie the way CURRENT_TIMESTAMP does at one-second resolution.
 */
export async function listRecentScans(
  db: SQLiteDatabase,
  limit = 50,
): Promise<ScanHistoryRow[]> {
  return db.getAllAsync<ScanHistoryRow>(
    "SELECT id, item_name, bin_result, region, scanned_at FROM scan_history ORDER BY id DESC LIMIT ?",
    limit,
  );
}

/** Seeded with every bin at zero so callers always have a complete set to render. */
export async function getBinCounts(db: SQLiteDatabase): Promise<Record<BinType, number>> {
  const rows = await db.getAllAsync<{ bin_result: string; count: number }>(
    "SELECT bin_result, COUNT(*) AS count FROM scan_history GROUP BY bin_result",
  );

  const counts: Record<BinType, number> = {
    recycling: 0,
    garbage: 0,
    compost: 0,
    "consult-local-guide": 0,
  };
  for (const row of rows) {
    if (row.bin_result in counts) counts[row.bin_result as BinType] = row.count;
  }
  return counts;
}

// Deliberately leaves sqlite_sequence alone: ids only need to stay monotonic, and
// not reusing them keeps them safe as list keys.
export async function clearScanHistory(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("DELETE FROM scan_history");
}

/** CURRENT_TIMESTAMP is UTC but carries no zone marker, so `new Date()` alone would read it as local. */
export function parseScannedAt(scannedAt: string): Date {
  return new Date(`${scannedAt.replace(" ", "T")}Z`);
}
