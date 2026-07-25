/**
 * The full-screen item result — pushed from the Search tab, slides in from the right
 * (`animation: "slide_from_right"` in `_layout.tsx`, which also gives the back-swipe).
 *
 * The body is `ResultView`, the exact same component the scan result sheet renders, so a
 * search result and a scan result are identical. This screen only supplies the host chrome:
 * a back header, a scroll container, and the context-specific left action ("Search again",
 * which goes back to search — the sheet's is "Scan another", which closes the sheet).
 * No history is written here.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ResultView } from "@/features/scan/ResultView";
import { FONT, useTheme } from "@/ui/theme";

export default function ItemScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { itemKey } = useLocalSearchParams<{ itemKey: string }>();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: theme.textMuted }]}>‹ Search</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ResultView
          itemKey={itemKey ?? ""}
          primaryActionLabel="Search again"
          onPrimaryAction={() => router.back()}
          onViewHistory={() => router.push("/history")}
          context="search"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  back: { fontFamily: FONT.utility, fontSize: 12, letterSpacing: 0.4 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, gap: 16 },
});
