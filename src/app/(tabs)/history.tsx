import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Wordmark } from "@/components/Wordmark";
import { BIN_LABEL, binColor } from "@/lib/bins";
import { parseScannedAt, type ScanHistoryRow } from "@/lib/db";
import { formatItemName } from "@/lib/regionData";
import { FONT, radii, useTheme } from "@/lib/theme";
import { useScanHistory } from "@/lib/useScanHistory";

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
  const accent = binColor(scan.bin_result);

  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.itemName, { color: theme.text }]}>
          {formatItemName(scan.item_name)}
        </Text>
        <Text style={[styles.binLabel, { color: accent }]}>{BIN_LABEL[scan.bin_result]}</Text>
      </View>
      <Text style={[styles.timestamp, { color: theme.textMuted }]}>
        {formatScannedAt(scan.scanned_at)}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const { data, error, loading } = useScanHistory();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Wordmark size={15} />
        <Text style={[styles.heading, { color: theme.text }]}>Sort history</Text>
      </View>

      {error ? (
        <View style={styles.body}>
          <Text style={[styles.placeholder, { color: theme.textMuted }]}>
            Couldn&apos;t load your history.
          </Text>
        </View>
      ) : (
        // `loading` renders an empty list rather than the empty-state copy, so
        // "No scans yet" can't flash before the first query returns.
        <FlatList
          data={data?.scans ?? []}
          keyExtractor={(scan) => String(scan.id)}
          renderItem={({ item }) => <ScanRow scan={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.body}>
                <Text style={[styles.placeholder, { color: theme.textMuted }]}>
                  No scans yet. Scanned items are saved here.
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
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  heading: {
    fontFamily: FONT.heading,
    fontSize: 26,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  list: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  rowMain: { flex: 1, gap: 3 },
  itemName: { fontFamily: FONT.bodyEmphasis, fontSize: 15 },
  binLabel: {
    fontFamily: FONT.utilityStrong,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  timestamp: { fontFamily: FONT.utility, fontSize: 11 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  placeholder: { fontFamily: FONT.body, fontSize: 14, textAlign: "center" },
});
