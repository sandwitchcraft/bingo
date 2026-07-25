/**
 * Settings tab. A scrolling list of preference rows, each one wired to the provider that
 * owns the state — this screen holds no preferences of its own.
 *
 * What it offers: theme mode, scan mode, the active region (pushes the full-screen picker
 * in `src/app/region.tsx`, which is also where location detection now lives), clear history,
 * and the dev-only seed/random-sort helpers. Rule updates are checked automatically on every
 * app open (see `regionStore.tsx`), so there is no manual refresh here.
 *
 * Feedback here is deliberately split. Failures with nowhere else to land go to the error
 * toast; successes confirm **inline** rather than as a banner, because a banner that also
 * carries good news gets dismissed unread.
 */
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { clearScanHistory } from "@/features/history/db";
import { seedScanHistory } from "@/features/history/devSeed";
import { getRandomItemKey, getRegionName, getRegionPath } from "@/features/region/regionData";
import { submitReport } from "@/features/reports/reports";
import { regionSubtitle } from "@/features/region/regionSource";
import { useRegion } from "@/features/region/regionStore";
import { useScanResult } from "@/features/scan/scanResult";
import { useScanSettings, type ScanMode } from "@/features/scan/scanSettings";
import { Wordmark } from "@/ui/Wordmark";
import { confirmDestructive, notify } from "@/ui/dialogs";
import { accent, FONT, radii, useTheme, type ThemePreference } from "@/ui/theme";
import { useToast } from "@/ui/toast";

// Light first: it's the brand's primary mode.
const MODES: { name: ThemePreference; label: string }[] = [
  { name: "light", label: "Light" },
  { name: "dark", label: "Dark" },
  { name: "system", label: "System" },
];

const SCAN_MODES: { name: ScanMode; label: string }[] = [
  { name: "continuous", label: "Auto-scan" },
  { name: "tap", label: "Tap to scan" },
];

export default function SettingsScreen() {
  const { theme, name, preference, setPreference } = useTheme();
  const { scanMode, setScanMode } = useScanSettings();
  const { rules, selectedId, catalog } = useRegion();
  const { showResult } = useScanResult();
  const { showError } = useToast();
  const router = useRouter();
  const db = useSQLiteContext();

  // Falls back to the rules' own location_path when the catalog hasn't loaded the
  // matching entry yet — the rules are always present, the index isn't.
  const selected = catalog.find((entry) => entry.id === selectedId);
  const regionParents = selected
    ? regionSubtitle(selected)
    : rules.location_path.slice(0, -1).reverse().join(", ");

  const confirmClearHistory = () => {
    confirmDestructive({
      title: "Clear sort history?",
      message: "This removes every saved scan. It can't be undone.",
      confirmLabel: "Clear",
      onConfirm: () => {
        clearScanHistory(db).catch((error: unknown) => {
          console.warn("[history] failed to clear history", error);
          notify("Couldn't clear history", "Something went wrong. Try again.");
        });
      },
    });
  };

  const sortRandomItem = () => {
    const itemKey = getRandomItemKey(rules);
    if (!itemKey) {
      notify("No items", "The active region's rules are empty.");
      return;
    }
    // Goes through showResult, so it logs a history row like a real scan does — that's
    // deliberate, it's also how you check the region name being written is the right one.
    showResult(itemKey);
  };

  // Dev-only backend smoke check: exercises the Supabase path through the RN runtime
  // (url-polyfill + supabase-js insert + the persisted anonymous device id). No image, so it
  // isolates the table insert from the storage upload. Stripped from release builds.
  const [backendResult, setBackendResult] = useState<string | null>(null);
  const testBackendReport = () => {
    setBackendResult(null);
    submitReport({
      region: getRegionPath(rules),
      itemKey: "plastic-bottle",
      reportedBin: "recycling",
      reportType: "wrong_bin",
      userNote: "__DEV_TEST__",
    })
      .then(({ success, error }) =>
        setBackendResult(success ? "Report submitted — backend reachable." : `Failed: ${error}`),
      )
      .catch((error: unknown) => setBackendResult(`Threw: ${String(error)}`));
  };

  const runSeed = () => {
    seedScanHistory(db, rules)
      .then((count) => notify("History seeded", `Added ${count} backdated scans.`))
      .catch((error: unknown) => {
        console.warn("[history] failed to seed history", error);
        notify("Couldn't seed history", "Something went wrong. Try again.");
      });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Wordmark size={15} />
        <Text style={[styles.heading, { color: theme.text }]}>Settings</Text>
      </View>

      {/* Scrolls: the section list is already taller than a small phone with the keyboard
          out of the picture, and every row added below pushes it further. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Region</Text>
        {/* Page-wide: the whole card is the tap target, unlike the outlined action
            buttons below, because pressing it navigates rather than acting in place. The
            picker itself now hosts location detection, at the top of its list. */}
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
            pressed && { backgroundColor: theme.bgInput },
          ]}
          onPress={() => router.push("/region")}
          accessibilityRole="button"
          accessibilityLabel={`Region, currently ${getRegionName(rules)}`}
        >
          <Text style={[styles.rowLabel, { color: theme.textBody }]}>Region</Text>
          <View style={styles.rowValue}>
            <View style={styles.rowValueText}>
              <Text style={[styles.rowValueName, { color: theme.text }]} numberOfLines={1}>
                {getRegionName(rules)}
              </Text>
              {regionParents !== "" && (
                <Text style={[styles.rowValueSub, { color: theme.textMuted }]} numberOfLines={1}>
                  {regionParents}
                </Text>
              )}
            </View>
            <Text style={[styles.chevron, { color: theme.textSubtle }]}>›</Text>
          </View>
        </Pressable>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }, styles.sectionSpacer]}>
          Appearance
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.rowLabel, { color: theme.textBody }]}>Mode</Text>
          <View style={[styles.segment, { backgroundColor: theme.bgInput }]}>
            {MODES.map((mode) => {
              // Tracks what was chosen, not what it resolved to: with "system" active
              // on a dark phone, "System" highlights — not "Dark".
              const active = preference === mode.name;
              return (
                <Pressable
                  key={mode.name}
                  style={[
                    styles.segmentButton,
                    active && {
                      backgroundColor: theme.segmentActiveBg,
                      borderColor: theme.segmentActiveBorder,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setPreference(mode.name)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        fontFamily: active ? FONT.utilityStrong : FONT.utility,
                        color: active ? accent[name] : theme.textMuted,
                      },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }, styles.sectionSpacer]}>
          Scanning
        </Text>
        <View style={[styles.stackCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.segment, { backgroundColor: theme.bgInput }]}>
            {SCAN_MODES.map((mode) => {
              const active = scanMode === mode.name;
              return (
                <Pressable
                  key={mode.name}
                  style={[
                    styles.segmentButtonWide,
                    active && {
                      backgroundColor: theme.segmentActiveBg,
                      borderColor: theme.segmentActiveBorder,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setScanMode(mode.name)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        fontFamily: active ? FONT.utilityStrong : FONT.utility,
                        color: active ? accent[name] : theme.textMuted,
                      },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.rowHint, { color: theme.textMuted }]}>
            {scanMode === "continuous"
              ? "Scans on its own — points the camera at an item and shows the result once it's confident. Heavier on the camera."
              : "Identifies an item only when you tap. Lighter, so the preview stays smooth."}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }, styles.sectionSpacer]}>
          Data
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.rowLabel, { color: theme.textBody }]}>Clear sort history</Text>
          {/* Neutral, not a warning color: the brand has no destructive token, and
              clay is reserved for the garbage bin indicator. */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { borderColor: theme.cardBorder },
              pressed && { backgroundColor: theme.bgInput },
            ]}
            onPress={confirmClearHistory}
            hitSlop={8}
          >
            <Text style={[styles.rowAction, { color: theme.textMuted }]}>Clear</Text>
          </Pressable>
        </View>

        {/* Test data for History's date formatting. Stripped from release builds. */}
        {__DEV__ && (
          <View
            style={[
              styles.card,
              styles.stackedRow,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.rowLabel, { color: theme.textBody }]}>Seed 20 test scans</Text>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: theme.cardBorder },
                pressed && { backgroundColor: theme.bgInput },
              ]}
              onPress={runSeed}
              hitSlop={8}
            >
              <Text style={[styles.rowAction, { color: theme.textMuted }]}>Seed</Text>
            </Pressable>
          </View>
        )}

        {/* Dev-only backend connectivity check. Inserts a tagged report row via Supabase to
            confirm the anonymous client works through the RN runtime. Stripped from release. */}
        {__DEV__ && (
          <>
            <View
              style={[
                styles.card,
                styles.stackedRow,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.rowLabel, { color: theme.textBody }]}>Test backend report</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  { borderColor: theme.cardBorder },
                  pressed && { backgroundColor: theme.bgInput },
                ]}
                onPress={testBackendReport}
                hitSlop={8}
              >
                <Text style={[styles.rowAction, { color: theme.textMuted }]}>Send</Text>
              </Pressable>
            </View>
            {backendResult != null && (
              <Text style={[styles.rowHint, { color: theme.textMuted }, styles.detectedNote]}>
                {backendResult}
              </Text>
            )}
          </>
        )}

        {/* Ships in release builds, unlike the seeder above. Sorts a random item from the
            *active* region's rules — the check that the app is reading the region you
            picked. The camera covers part of that job now that the bundled model is an
            ImageNet classifier — bottles, cups, cardboard and apples reach real rules — but
            it still can't produce the material-dependent keys (styrofoam, takeout containers,
            batteries), so this stays the only way to exercise those. Not dev-gated for the
            same reason. Retire it with `getRandomItemKey` once the trained classifier lands. */}
        <View
          style={[
            styles.card,
            styles.stackedRow,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.rowLabel, { color: theme.textBody }]}>Sort a random item</Text>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { borderColor: theme.cardBorder },
              pressed && { backgroundColor: theme.bgInput },
            ]}
            onPress={sortRandomItem}
            hitSlop={8}
          >
            <Text style={[styles.rowAction, { color: theme.textMuted }]}>Sort</Text>
          </Pressable>
        </View>
        <Text style={[styles.rowHint, { color: theme.textMuted }, styles.detectedNote]}>
          Shows a real result from this region&apos;s rules, and logs it to history — the
          camera can&apos;t yet, since the bundled model doesn&apos;t know item names.
        </Text>

        <Text style={[styles.note, { color: theme.textMuted }]}>
          Preferences and support settings are not yet available.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  heading: { fontFamily: FONT.heading, fontSize: 26, letterSpacing: -0.4, marginTop: 4 },
  scroll: { flex: 1 },
  // Bottom padding clears the tab bar — the last row would otherwise sit under it with
  // nothing left to scroll.
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  sectionLabel: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  sectionSpacer: { marginTop: 28 },
  /** A second (or third) card inside one section, under the first. */
  stackedRow: { marginTop: 10 },
  /** An explanatory or confirmation line sitting under the card it belongs to. */
  detectedNote: { marginTop: 8, paddingHorizontal: 4 },
  rowLabel: { fontFamily: FONT.body, fontSize: 14 },
  // The value side of a navigation row: name over its parent path, then the chevron.
  rowValue: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  rowValueText: { alignItems: "flex-end", flexShrink: 1 },
  rowValueName: { fontFamily: FONT.bodyEmphasis, fontSize: 14 },
  rowValueSub: { fontFamily: FONT.utility, fontSize: 10, letterSpacing: 0.4, marginTop: 2 },
  chevron: { fontFamily: FONT.body, fontSize: 20, lineHeight: 22 },
  rowAction: {
    fontFamily: FONT.utilityStrong,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  // The button, not the whole card, is the tap target now that it's outlined —
  // an outline that isn't the thing you press reads as a lie.
  actionButton: {
    borderWidth: 1,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  // Vertical card: a full-width control stacked above its explanatory hint.
  stackCard: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  segment: {
    flexDirection: "row",
    borderRadius: radii.button,
    padding: 3,
    gap: 3,
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: "transparent",
  },
  // Full-width variant: each option shares the row evenly (used by the Scanning segment,
  // whose labels are too wide to sit inline next to a row label).
  segmentButtonWide: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentText: { fontSize: 11, letterSpacing: 0.4 },
  rowHint: {
    fontFamily: FONT.body,
    fontSize: 12,
    lineHeight: 17,
  },
  note: {
    fontFamily: FONT.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
  },
});
