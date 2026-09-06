/**
 * History tab: the list of past scans, newest first, read from SQLite through
 * `useScanHistory` (which refetches on focus).
 *
 * Rows store the item **key**, so the display name and bin colour are resolved against the
 * *currently active* region's rules at render time — an old scan re-renders under whatever
 * rules are loaded now, which is intentional. `formatScannedAt` below is the only
 * date-rendering rule: time alone for today, date · time once it isn't.
 *
 * Each row is the sheet's item row: the bin's lid, the item, the bin's name in its tint ink.
 */
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BIN_SHORT_LABEL } from "@/core/bins";
import { parseScannedAt, type ScanHistoryRow } from "@/features/history/db";
import { useScanHistory } from "@/features/history/useScanHistory";
import { getItemDisplayName } from "@/features/region/regionData";
import { useRegionRules } from "@/features/region/regionStore";
import { Lid } from "@/ui/Lid";
import { Wordmark } from "@/ui/Wordmark";
import { radii, TYPE, useTheme } from "@/ui/theme";

/** Date only once it's no longer today, since the day is the useful part by then. */
function formatScannedAt(scannedAt: string): string {
  const date = parseScannedAt(scannedAt);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const isToday = date.toDateString() === new Date().toDateString();
  if (isToday) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

function ScanRow({ scan }: { scan: ScanHistoryRow }) {
  const { theme } = useTheme();
  const rules = useRegionRules();
  const swatch = theme.bins[scan.bin_result];

  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Lid bin={scan.bin_result} />
      <View style={styles.rowMain}>
        <Text style={[TYPE.row, { color: theme.text }]} numberOfLines={1}>
          {/* Rows scanned under a different region fall back to the formatted key. */}
          {getItemDisplayName(rules, scan.item_name)}
        </Text>
        <Text style={[TYPE.mono, { color: theme.text2 }]}>{formatScannedAt(scan.scanned_at)}</Text>
      </View>
      <Text style={[TYPE.rowBin, { color: swatch.tintInk }]}>{BIN_SHORT_LABEL[scan.bin_result]}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const { data, error, loading } = useScanHistory();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Wordmark />
        <Text style={[TYPE.h2, styles.heading, { color: theme.text }]}>History</Text>
      </View>

      {error ? (
        <View style={styles.body}>
          <Text style={[TYPE.bodySm, styles.placeholder, { color: theme.text2 }]}>
            Couldn&apos;t load your history.
          </Text>
        </View>
      ) : (
        // `loading` renders an empty list rather than the empty-state copy, so
        // "Nothing yet" can't flash before the first query returns.
        <FlatList
          data={data?.scans ?? []}
          keyExtractor={(scan) => String(scan.id)}
          renderItem={({ item }) => <ScanRow scan={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.body}>
                <Text style={[TYPE.bodySm, styles.placeholder, { color: theme.text2 }]}>
                  Nothing sorted yet. Items you scan are saved here.
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14, gap: 14 },
  heading: {},
  list: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 32, gap: 9 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowMain: { flex: 1, gap: 2 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  placeholder: { textAlign: "center" },
});
