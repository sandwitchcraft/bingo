/**
 * Settings tab. A scrolling list of preference rows, each one wired to the provider that
 * owns the state — this screen holds no preferences of its own.
 *
 * What it offers: theme mode, scan mode, clear history, and the dev-only seed/random-sort
 * helpers. The active region has its own tab (Location), so it isn't repeated here. Rule updates are checked automatically on every
 * app open (see `regionStore.tsx`), so there is no manual refresh here.
 *
 * Feedback here is deliberately split. Failures with nowhere else to land go to the error
 * toast; successes confirm **inline** rather than as a banner, because a banner that also
 * carries good news gets dismissed unread.
 */
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { clearScanHistory } from "@/features/history/db";
import { seedScanHistory } from "@/features/history/devSeed";
import { getRandomItemKey, getRegionPath } from "@/features/region/regionData";
import { submitReport } from "@/features/reports/reports";
import { useRegion } from "@/features/region/regionStore";
import { useScanResult } from "@/features/scan/scanResult";
import { useScanSettings, type ScanMode } from "@/features/scan/scanSettings";
import { Wordmark } from "@/ui/Wordmark";
import { confirmDestructive, notify } from "@/ui/dialogs";
import { FONT, radii, TYPE, useTheme, type ThemePreference } from "@/ui/theme";
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
  const { theme, preference, setPreference } = useTheme();
  const { scanMode, setScanMode } = useScanSettings();
  const { rules } = useRegion();
  const { showResult } = useScanResult();
  const { showError } = useToast();
  const db = useSQLiteContext();

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
        <Wordmark />
        <Text style={[TYPE.h2, { color: theme.text }]}>Settings</Text>
      </View>

      {/* Scrolls: the section list is already taller than a small phone with the keyboard
          out of the picture, and every row added below pushes it further. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sectionLabel, { color: theme.text2 }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Mode</Text>
          <View style={[styles.segment, { backgroundColor: theme.surface }]}>
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
                      backgroundColor: theme.card,
                      borderColor: theme.line,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setPreference(mode.name)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        fontFamily: FONT.bodyStrong,
                        color: active ? theme.accentInk : theme.text2,
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

        <Text style={[styles.sectionLabel, { color: theme.text2 }, styles.sectionSpacer]}>
          Scanning
        </Text>
        <View style={[styles.stackCard, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <View style={[styles.segment, { backgroundColor: theme.surface }]}>
            {SCAN_MODES.map((mode) => {
              const active = scanMode === mode.name;
              return (
                <Pressable
                  key={mode.name}
                  style={[
                    styles.segmentButtonWide,
                    active && {
                      backgroundColor: theme.card,
                      borderColor: theme.line,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setScanMode(mode.name)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        fontFamily: FONT.bodyStrong,
                        color: active ? theme.accentInk : theme.text2,
                      },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.rowHint, { color: theme.text2 }]}>
            {scanMode === "continuous"
              ? "Scans on its own — points the camera at an item and shows the result once it's confident. Heavier on the camera."
              : "Identifies an item only when you tap. Lighter, so the preview stays smooth."}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text2 }, styles.sectionSpacer]}>
          Data
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Clear sort history</Text>
          {/* Neutral, not a warning colour: the sheet's only red is the error banner, and
              a button that reads as an error would overstate what "Clear" does. */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { borderColor: theme.lineStrong },
              pressed && { backgroundColor: theme.surface },
            ]}
            onPress={confirmClearHistory}
            hitSlop={8}
          >
            <Text style={[styles.rowAction, { color: theme.text }]}>Clear</Text>
          </Pressable>
        </View>

        {/* Test data for History's date formatting. Stripped from release builds. */}
        {__DEV__ && (
          <View
            style={[
              styles.card,
              styles.stackedRow,
              { backgroundColor: theme.card, borderColor: theme.line },
            ]}
          >
            <Text style={[styles.rowLabel, { color: theme.text }]}>Seed 20 test scans</Text>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: theme.lineStrong },
                pressed && { backgroundColor: theme.surface },
              ]}
              onPress={runSeed}
              hitSlop={8}
            >
              <Text style={[styles.rowAction, { color: theme.text }]}>Seed</Text>
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
                { backgroundColor: theme.card, borderColor: theme.line },
              ]}
            >
              <Text style={[styles.rowLabel, { color: theme.text }]}>Test backend report</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  { borderColor: theme.lineStrong },
                  pressed && { backgroundColor: theme.surface },
                ]}
                onPress={testBackendReport}
                hitSlop={8}
              >
                <Text style={[styles.rowAction, { color: theme.text }]}>Send</Text>
              </Pressable>
            </View>
            {backendResult != null && (
              <Text style={[styles.rowHint, { color: theme.text2 }, styles.detectedNote]}>
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
            { backgroundColor: theme.card, borderColor: theme.line },
          ]}
        >
          <Text style={[styles.rowLabel, { color: theme.text }]}>Sort a random item</Text>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { borderColor: theme.lineStrong },
              pressed && { backgroundColor: theme.surface },
            ]}
            onPress={sortRandomItem}
            hitSlop={8}
          >
            <Text style={[styles.rowAction, { color: theme.text }]}>Sort</Text>
          </Pressable>
        </View>
        <Text style={[styles.rowHint, { color: theme.text2 }, styles.detectedNote]}>
          Shows a real result from this region&apos;s rules, and logs it to history — the
          camera can&apos;t yet, since the bundled model doesn&apos;t know item names.
        </Text>

        <Text style={[styles.note, { color: theme.text2 }]}>
          Preferences and support settings are not yet available.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14, gap: 14 },
  scroll: { flex: 1 },
  // Bottom padding clears the tab bar — the last row would otherwise sit under it with
  // nothing left to scroll.
  body: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 48 },
  sectionLabel: { ...TYPE.micro, marginBottom: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 17,
    paddingVertical: 15,
  },
  sectionSpacer: { marginTop: 28 },
  /** A second (or third) card inside one section, under the first. */
  stackedRow: { marginTop: 10 },
  /** An explanatory or confirmation line sitting under the card it belongs to. */
  detectedNote: { marginTop: 8, paddingHorizontal: 4 },
  rowLabel: { ...TYPE.row },
  rowAction: { ...TYPE.button, fontSize: 14, lineHeight: 18 },
  // The button, not the whole card, is the tap target now that it's outlined —
  // an outline that isn't the thing you press reads as a lie. Secondary-button styling.
  actionButton: {
    borderWidth: 1,
    borderRadius: radii.chip,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Vertical card: a full-width control stacked above its explanatory hint.
  stackCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 17,
    paddingVertical: 15,
    gap: 12,
  },
  // A surface-coloured track holding pill segments; the selected one is raised to card.
  segment: {
    flexDirection: "row",
    borderRadius: radii.chip,
    padding: 3,
    gap: 3,
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: "transparent",
  },
  // Full-width variant: each option shares the row evenly (used by the Scanning segment,
  // whose labels are too wide to sit inline next to a row label).
  segmentButtonWide: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentText: { ...TYPE.tag, fontSize: 13, lineHeight: 16 },
  rowHint: { ...TYPE.small },
  note: { ...TYPE.small, marginTop: 16 },
});
