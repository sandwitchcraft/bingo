/**
 * The full-screen item result — pushed from the Search tab, slides in from the right
 * (`animation: "slide_from_right"` in `_layout.tsx`, which also gives the back-swipe).
 *
 * The body is `ResultView`, the exact same component the scan result sheet renders, so a
 * search result and a scan result are identical. This screen only supplies the host chrome:
 * the Answer screen header (a round back button and the place chip — live, so the item can be
 * re-sorted for another place), a scroll container, and
 * the context-specific left action ("Search again", which goes back to search — the sheet's
 * is "Scan another", which closes the sheet). No history is written here.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LocationChip } from "@/features/region/LocationChip";
import { ResultView } from "@/features/scan/ResultView";
import { ChevronLeftGlyph } from "@/ui/Icons";
import { radii, useTheme } from "@/ui/theme";

export default function ItemScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { itemKey } = useLocalSearchParams<{ itemKey: string }>();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to search"
          style={({ pressed }) => [
            styles.back,
            { borderColor: theme.lineStrong, backgroundColor: pressed ? theme.surface : "transparent" },
          ]}
        >
          <ChevronLeftGlyph size={18} color={theme.text} />
        </Pressable>
        <LocationChip itemKey={itemKey ?? ""} />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 8,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: radii.chip,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40, gap: 18 },
});
