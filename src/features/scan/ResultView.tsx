/**
 * The shared result body — item name, bin outcome, the "why" note, the local-guide link,
 * and the action set. Rendered identically by the scan result sheet (`ScanResultSheet`) and
 * the full-screen search result (`app/item.tsx`) so the two can never drift; each host
 * supplies its own scroll container and the one context-specific action.
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
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BIN_LABEL, binColor, binSurface } from "@/core/bins";
import { resolveScanResult } from "@/features/region/regionData";
import { useRegionRules } from "@/features/region/regionStore";
import { useReport, type ReportContext } from "@/features/reports/reportStore";
import { FONT, radii, useTheme } from "@/ui/theme";

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
};

export function ResultView({
  itemKey,
  primaryActionLabel,
  onPrimaryAction,
  onViewHistory,
  context,
}: ResultViewProps) {
  const { theme } = useTheme();
  const rules = useRegionRules();
  const { open: openReport } = useReport();

  // resolveScanResult always returns a result — a real rule, or the consult-guide fallback
  // for a key this region doesn't list — so there's no not-found state to handle.
  const result = resolveScanResult(rules, itemKey);
  const surface = binSurface(result.bin);
  const accent = binColor(result.bin);
  const guideUrl = result.link ?? rules.site_url;

  return (
    <Fragment>
      {/* Item header — the name itself carries the bin's outcome color. */}
      <View style={styles.itemHeader}>
        <Text style={[styles.eyebrow, { color: theme.textMuted }]}>Item</Text>
        <Text style={[styles.itemName, { color: accent }]}>{result.display_name}</Text>
      </View>

      {/* Bin outcome */}
      <View style={[styles.binCard, { backgroundColor: surface.bg, borderColor: surface.border }]}>
        <Text style={[styles.eyebrow, { color: theme.textMuted }]}>Sort into</Text>
        <Text style={[styles.binLabel, { color: accent }]}>{BIN_LABEL[result.bin]}</Text>
      </View>

      {/* Handling detail */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.eyebrow, { color: theme.textMuted }]}>Why</Text>
        <Text style={[styles.body, { color: theme.textBody }]}>{result.description}</Text>
      </View>

      {/* Local guide — featured for every item, not only consult-guide results. */}
      {guideUrl ? (
        <Pressable
          style={[styles.linkRow, { borderColor: surface.border, backgroundColor: surface.bg }]}
          onPress={() => WebBrowser.openBrowserAsync(guideUrl)}
        >
          <Text style={[styles.linkText, { color: accent }]}>View local disposal guide ↗</Text>
        </Pressable>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.secondaryBg }]}
          onPress={onPrimaryAction}
        >
          <Text style={[styles.btnText, { color: theme.secondaryText }]}>{primaryActionLabel}</Text>
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: theme.primary }]} onPress={onViewHistory}>
          <Text style={[styles.btnText, { color: theme.primaryText }]}>View history</Text>
        </Pressable>
      </View>

      {/* Report incorrect sort — opens the root-mounted report sheet for this item. */}
      <Pressable style={styles.reportRow} onPress={() => openReport(itemKey, context)}>
        <Text style={[styles.reportText, { color: theme.textMuted }]}>Report incorrect sort</Text>
      </Pressable>
    </Fragment>
  );
}

const styles = StyleSheet.create({
  itemHeader: { paddingTop: 4 },
  eyebrow: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  itemName: {
    fontFamily: FONT.display,
    fontSize: 26,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  binCard: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  binLabel: {
    fontFamily: FONT.heading,
    fontSize: 20,
    letterSpacing: -0.2,
    marginTop: 3,
  },
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  body: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21 },
  linkRow: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  linkText: { fontFamily: FONT.utilityStrong, fontSize: 12 },
  actions: { flexDirection: "row", gap: 12 },
  btn: {
    flex: 1,
    borderRadius: radii.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { fontFamily: FONT.utilityStrong, fontSize: 12 },
  reportRow: { alignItems: "center", paddingVertical: 4 },
  reportText: { fontFamily: FONT.utility, fontSize: 11, letterSpacing: 0.2 },
});
