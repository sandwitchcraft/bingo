/**
 * Search tab — look an item up by name and open its bin result.
 *
 * The manual counterpart to the Scan tab: no camera, no model. A Wordmark header sits at the
 * top in both states, matching the History and Settings tabs. Idle, the prompt (heading +
 * field + hint) is centered in the space under that header via a pair of flex spacers; once
 * the field is focused or holds text, the screen switches to its active layout — the field
 * just under the header, the results list filling the rest. Selecting a result, or pressing
 * the keyboard's Search key, pushes the full-screen `item` window.
 *
 * The FlatList is a direct child of the flex:1 SafeAreaView, which is what makes it scroll.
 * `keyboardDismissMode="on-drag"` means a scroll hides the keyboard, bringing the tab bar
 * back. The field carries a stable `key` and stays a direct child of the container in both
 * states, so the idle→active swap doesn't remount it (the keyboard survives the transition).
 *
 * The query lives in a module-level variable, so it survives leaving and returning to the
 * tab within a session but resets on a cold app launch (the module reloads fresh).
 */
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BIN_LABEL, binColor } from "@/core/bins";
import { useRegionRules } from "@/features/region/regionStore";
import { searchItems, type ItemHit } from "@/features/search/searchItems";
import { Wordmark } from "@/ui/Wordmark";
import { FONT, radii, useTheme } from "@/ui/theme";

// Survives tab switches and navigating to a result and back — but not a relaunch, since the
// module is re-evaluated with a fresh JS context on cold start.
let sessionQuery = "";
let sessionEngaged = false;

export default function SearchScreen() {
  const { theme } = useTheme();
  const rules = useRegionRules();
  const router = useRouter();

  const [query, setQueryState] = useState(sessionQuery);
  // `engaged` is the search-mode latch. It turns on when the field is first focused and
  // stays on through a keyboard dismissal — critically, scrolling dismisses the keyboard
  // (keyboardDismissMode="on-drag"), and if "show the list" were tied to live focus, that
  // first drag would blur the field and collapse the list back to the prompt before any
  // scroll happened. Only clearing (the ✕) turns it back off.
  const [engaged, setEngagedState] = useState(sessionEngaged);
  const active = engaged || query.trim() !== "";

  const setQuery = useCallback((next: string) => {
    sessionQuery = next;
    setQueryState(next);
  }, []);

  const setEngaged = useCallback((next: boolean) => {
    sessionEngaged = next;
    setEngagedState(next);
  }, []);

  const results = useMemo(() => searchItems(rules, query), [rules, query]);

  const openItem = (itemKey: string) => {
    // Dismiss the keyboard before pushing, not during. If it's still up when the slide
    // starts, iOS animates it down over the transition and its QuickType/accessory strip
    // detaches and hangs in the middle of the screen for the length of the animation.
    // `engaged` stays latched, so the results list is still there when you come back.
    Keyboard.dismiss();
    router.push({ pathname: "/item", params: { itemKey } });
  };

  const clear = () => {
    setQuery("");
    setEngaged(false);
    Keyboard.dismiss();
  };

  // The keyboard "Search" key commits the top result, if there is one.
  const submit = () => {
    if (results.length > 0) openItem(results[0].itemKey);
  };

  const renderRow = ({ item: hit }: { item: ItemHit }) => {
    const accent = binColor(hit.item.bin);
    return (
      <Pressable
        style={[styles.row, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={() => openItem(hit.itemKey)}
        accessibilityRole="button"
        accessibilityLabel={`${hit.item.display_name}, ${BIN_LABEL[hit.item.bin]}`}
      >
        <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
          {hit.item.display_name}
        </Text>
        <Text style={[styles.rowBin, { color: accent }]}>{BIN_LABEL[hit.item.bin]}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      {/* Wordmark header, matching the History and Settings tabs. */}
      <View key="header" style={styles.header}>
        <Wordmark size={15} />
      </View>

      {/* Idle centering is done with flex spacers around the prompt cluster rather than by
          centering the whole screen — that keeps the header pinned at the top and, crucially,
          keeps the field a stable direct child of this container in both states, so the
          idle→active swap never remounts it and the keyboard survives the transition. */}
      {!active && <View key="spacerTop" style={styles.flexSpacer} />}
      {!active && (
        <Text key="heading" style={[styles.heading, { color: theme.text }]}>
          Search for an item
        </Text>
      )}

      <View key="field" style={[styles.fieldRow, { backgroundColor: theme.bgInput }]}>
        <TextInput
          style={[styles.field, { color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setEngaged(true)}
          onSubmitEditing={submit}
          placeholder="Search items"
          placeholderTextColor={theme.textSubtle}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query !== "" && (
          <Pressable
            style={[styles.clearButton, { backgroundColor: theme.textMuted }]}
            onPress={clear}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={[styles.clearGlyph, { color: theme.bgInput }]}>✕</Text>
          </Pressable>
        )}
      </View>

      {!active && (
        <Text key="subheading" style={[styles.subheading, { color: theme.textMuted }]}>
          Tip: try searching “Hot Beverage Cup” instead of “Coffee Cup”.
        </Text>
      )}
      {!active && <View key="spacerBottom" style={styles.flexSpacer} />}

      {active && (
        <FlatList
          key="list"
          // flex:1 is load-bearing: the screen root is bounded (the tab navigator wraps each
          // scene in absoluteFill), but Yoga won't stretch a no-flex ScrollView to fill the
          // space left by the field above it — without this the list sizes to its content and
          // there's nothing to scroll.
          style={styles.list}
          data={results}
          keyExtractor={(hit) => hit.itemKey}
          renderItem={renderRow}
          ItemSeparatorComponent={RowGap}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              No items match “{query.trim()}”.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  // Idle: paired with its twin below the prompt, this centers the prompt cluster in the
  // space left under the header (see the layout note in the component).
  flexSpacer: { flex: 1 },
  heading: {
    fontFamily: FONT.display,
    fontSize: 24,
    letterSpacing: -0.4,
    textAlign: "center",
    marginHorizontal: 24,
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.button,
    paddingHorizontal: 18,
    marginHorizontal: 24,
    gap: 10,
  },
  field: {
    flex: 1,
    fontFamily: FONT.body,
    fontSize: 15,
    paddingVertical: 14,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  clearGlyph: { fontFamily: FONT.utilityStrong, fontSize: 12, lineHeight: 14 },
  subheading: {
    fontFamily: FONT.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginHorizontal: 24,
    marginTop: 14,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  rowGap: { height: 10 },
  rowName: { fontFamily: FONT.heading, fontSize: 16, flexShrink: 1 },
  rowBin: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  empty: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19, paddingTop: 8 },
});
