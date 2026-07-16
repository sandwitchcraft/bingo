import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONT, useTheme, type ThemeName } from "@/lib/theme";

const MODES: { name: ThemeName; emoji: string; label: string }[] = [
  { name: "dark", emoji: "🌙", label: "Dark" },
  { name: "light", emoji: "☀️", label: "Light" },
];

export default function SettingsScreen() {
  const { theme, name, setThemeName } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.textMuted }]}>SortScan</Text>
        <Text style={[styles.heading, { color: theme.text }]}>Settings</Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.rowLabel, { color: theme.textBody }]}>Mode</Text>
          <View style={[styles.segment, { backgroundColor: theme.bgInput }]}>
            {MODES.map((mode) => {
              const active = name === mode.name;
              return (
                <Pressable
                  key={mode.name}
                  style={[
                    styles.segmentButton,
                    active && {
                      backgroundColor: theme.card,
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowOffset: { width: 0, height: 1 },
                      shadowRadius: 3,
                      elevation: 2,
                    },
                  ]}
                  onPress={() => setThemeName(mode.name)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.primary : theme.textMuted },
                    ]}
                  >
                    {mode.emoji} {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.note, { color: theme.textSubtle }]}>
          More settings (region, preferences, support) coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  eyebrow: {
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heading: { fontFamily: FONT.semibold, fontSize: 24, marginTop: 4 },
  body: { paddingHorizontal: 24, paddingTop: 8 },
  sectionLabel: {
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    opacity: 0.5,
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowLabel: { fontFamily: FONT.regular, fontSize: 14 },
  segment: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 2,
    gap: 2,
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentText: { fontFamily: FONT.medium, fontSize: 12 },
  note: {
    fontFamily: FONT.regular,
    fontSize: 12,
    marginTop: 16,
  },
});
