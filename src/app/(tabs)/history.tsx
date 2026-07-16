import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Wordmark } from "@/components/Wordmark";
import { FONT, useTheme } from "@/lib/theme";

export default function HistoryScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Wordmark size={15} />
        <Text style={[styles.heading, { color: theme.text }]}>Sort history</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.placeholder, { color: theme.textMuted }]}>
          No scans yet. Scanned items are saved here.
        </Text>
      </View>
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
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  placeholder: { fontFamily: FONT.body, fontSize: 14, textAlign: "center" },
});
