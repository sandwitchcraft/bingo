import { useSQLiteContext } from "expo-sqlite";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Wordmark } from "@/components/Wordmark";
import { clearScanHistory } from "@/lib/db";
import { seedScanHistory } from "@/lib/devSeed";
import { confirmDestructive, notify } from "@/lib/dialogs";
import { accent, FONT, radii, useTheme, type ThemePreference } from "@/lib/theme";

// Light first: it's the brand's primary mode.
const MODES: { name: ThemePreference; label: string }[] = [
  { name: "light", label: "Light" },
  { name: "dark", label: "Dark" },
  { name: "system", label: "System" },
];

export default function SettingsScreen() {
  const { theme, name, preference, setPreference } = useTheme();
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

  const runSeed = () => {
    seedScanHistory(db)
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

      <View style={styles.body}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Appearance</Text>
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
              styles.devRow,
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

        <Text style={[styles.note, { color: theme.textMuted }]}>
          Region, preferences, and support settings are not yet available.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  heading: { fontFamily: FONT.heading, fontSize: 26, letterSpacing: -0.4, marginTop: 4 },
  body: { paddingHorizontal: 24, paddingTop: 8 },
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
  devRow: { marginTop: 10 },
  rowLabel: { fontFamily: FONT.body, fontSize: 14 },
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
  segmentText: { fontSize: 11, letterSpacing: 0.4 },
  note: {
    fontFamily: FONT.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
  },
});
