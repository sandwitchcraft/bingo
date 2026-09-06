/**
 * The shared answer body — "Sorted item", the bin card, the reason, the local-guide row
 * and the action set. Rendered identically by the scan result sheet (`ScanResultSheet`) and
 * the full-screen search result (`app/item.tsx`) so the two can never drift; each host
 * supplies its own scroll container and the one context-specific action.
 *
 * Order is the voice rule: bin, then reason, then where to check. The bin card is the only
 * block of colour on the screen — it takes the bin's full fill with the ink that sits on it,
 * so the colour IS the answer — no provider name on it, the place chip in the host's header
 * already says where you are. The reason is an accent-tint note; the guide row is a plain
 * hairline row with its text in the link green.
 *
 * The local-guide link is featured for EVERY item: `result.link` is only populated for the
 * consult-guide fallback, so it falls back to the region's own `site_url` — always the best
 * "where do I look" answer.
 *
 * Returns a fragment of blocks, not a scroll container: the host provides `paddingHorizontal`
 * and the `gap` between blocks so the body sits correctly inside either a bottom sheet or a
 * full screen.
 */
import * as WebBrowser from "expo-web-browser";
import { Fragment, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BIN_LABEL } from "@/core/bins";
import { getRegionName, resolveScanResult } from "@/features/region/regionData";
import { useRegionRules } from "@/features/region/regionStore";
import { useReport, type ReportContext } from "@/features/reports/reportStore";
import { Button } from "@/ui/Button";
import { ExternalGlyph, InfoGlyph } from "@/ui/Icons";
import { radii, TYPE, useTheme } from "@/ui/theme";

type ResultViewProps = {
  itemKey: string;
  /** The left action — the one part that differs by context: "Scan another" / "Search again". */
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  onViewHistory: () => void;
  /**
   * Which host this is rendered in. Drives the report flow: only `scan` can report a
   * misidentification (search picks the item by name), so `search` skips that choice.
   */
  context: ReportContext;
  /**
   * Sits on the "Sorted item" line, right-aligned — the result sheet puts its place chip here
   * so it shares the header row instead of pushing the answer down. The full-screen host has
   * its own header and passes nothing.
   */
  headerRight?: ReactNode;
};

export function ResultView({
  itemKey,
  primaryActionLabel,
  onPrimaryAction,
  onViewHistory,
  context,
  headerRight,
}: ResultViewProps) {
  const { theme } = useTheme();
  const rules = useRegionRules();
  const { open: openReport } = useReport();

  // resolveScanResult always returns a result — a real rule, or the consult-guide fallback
  // for a key this region doesn't list — so there's no not-found state to handle.
  const result = resolveScanResult(rules, itemKey);
  const swatch = theme.bins[result.bin];
  const guideUrl = result.link ?? rules.site_url;
  const regionName = getRegionName(rules);

  return (
    <Fragment>
      {/* What was asked. Plain ink — the card below carries the colour. */}
      <View style={styles.itemHeader}>
        <View style={styles.itemText}>
          <Text style={[TYPE.micro, { color: theme.text2 }]}>Sorted item</Text>
          <Text style={[TYPE.h3, styles.itemName, { color: theme.text }]}>{result.display_name}</Text>
        </View>
        {headerRight}
      </View>

      {/* The answer: the bin's full fill, its ink on top. */}
      <View style={[styles.binCard, { backgroundColor: swatch.fill }]}>
        <Text style={[TYPE.micro, styles.goesIn, { color: swatch.ink }]}>Goes in</Text>
        <Text
          style={[TYPE.answer, { color: swatch.ink }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {BIN_LABEL[result.bin]}
        </Text>
      </View>

      {/* The reason. */}
      {result.description ? (
        <View style={[styles.note, { backgroundColor: theme.accentTint }]}>
          <InfoGlyph size={19} color={theme.accentInk} />
          <Text style={[TYPE.note, styles.noteText, { color: theme.accentInk }]}>
            {result.description}
          </Text>
        </View>
      ) : null}

      {/* Where to check — featured for every item, not only consult-guide results. */}
      {guideUrl ? (
        <View style={styles.section}>
          <Text style={[TYPE.micro, { color: theme.text2 }]}>If you're not sure</Text>
          <Pressable
            style={({ pressed }) => [
              styles.guideRow,
              { borderColor: theme.line, backgroundColor: pressed ? theme.surface : "transparent" },
            ]}
            onPress={() => WebBrowser.openBrowserAsync(guideUrl)}
            accessibilityRole="link"
            accessibilityLabel={`Open the ${regionName} waste guide`}
          >
            <Text style={[TYPE.note, styles.guideText, { color: theme.accentStrong }]}>
              Check out your region's sorting guide
            </Text>
            <ExternalGlyph size={18} color={theme.accentStrong} />
          </Pressable>
        </View>
      ) : null}

      {/* Actions: two solid pills sharing the row — the context action in beige, history in
          green — with the report flow as green text underneath. */}
      <View style={styles.actions}>
        <Button label={primaryActionLabel} variant="tonal" style={styles.actionMain} onPress={onPrimaryAction} />
        <Button label="View history" variant="primary" style={styles.actionMain} onPress={onViewHistory} />
      </View>
      <Button
        label="Report a problem"
        variant="ghost"
        size="sm"
        onPress={() => openReport(itemKey, context)}
        style={styles.reportBtn}
      />
    </Fragment>
  );
}

const styles = StyleSheet.create({
  itemHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  itemText: { flex: 1 },
  itemName: { marginTop: 4 },
  binCard: {
    borderRadius: radii.xl,
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 16,
  },
  goesIn: { opacity: 0.8, letterSpacing: 1.2 },
  note: {
    flexDirection: "row",
    gap: 11,
    paddingHorizontal: 17,
    paddingVertical: 15,
    borderRadius: radii.md,
    alignItems: "flex-start",
  },
  noteText: { flex: 1 },
  section: { gap: 9 },
  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  guideText: { flex: 1 },
  actions: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4 },
  actionMain: { flex: 1 },
  reportBtn: { alignSelf: "center" },
});
