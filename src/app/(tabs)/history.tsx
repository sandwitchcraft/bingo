import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONT, useTheme } from "@/lib/theme";

export default function HistoryScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.textMuted }]}>SortScan</Text>
        <Text style={[styles.heading, { color: theme.text }]}>Sort History</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.placeholder, { color: theme.textSubtle }]}>
          Your scan history will appear here.
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
  heading: {
    fontFamily: FONT.semibold,
    fontSize: 24,
    marginTop: 4,
  },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  placeholder: { fontFamily: FONT.regular, fontSize: 14, textAlign: "center" },
});
