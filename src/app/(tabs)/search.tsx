/**
 * Search tab — the "Ask" screen: look an item up by name and open its bin result.
 *
 * The manual counterpart to the Scan tab: no camera, no model. The header carries the
 * wordmark and the place chip (the place changes every answer below it). Idle, the screen
 * prompts "Try searching for an item" over the field, lists what was asked here before (the
 * most recent distinct scans, from history), and pins "Scan it instead" to the bottom. Once the field is focused or holds text, the recents and the
 * pinned action give way to the results list.
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

import { BIN_SHORT_LABEL, type BinType } from "@/core/bins";
import { useScanHistory } from "@/features/history/useScanHistory";
import { LocationChip } from "@/features/region/LocationChip";
import { getItemDisplayName } from "@/features/region/regionData";
import { useRegionRules } from "@/features/region/regionStore";
import { searchItems, type ItemHit } from "@/features/search/searchItems";
import { Button } from "@/ui/Button";
import { CameraGlyph, CloseGlyph, SearchGlyph } from "@/ui/Icons";
import { Lid } from "@/ui/Lid";
import { Wordmark } from "@/ui/Wordmark";
import { radii, TYPE, useTheme } from "@/ui/theme";

// Survives tab switches and navigating to a result and back — but not a relaunch, since the
// module is re-evaluated with a fresh JS context on cold start.
let sessionQuery = "";
let sessionEngaged = false;

/** How many "asked here before" rows the idle screen shows. */
const RECENTS = 4;

/** A lid, an item name, and the bin's short name in its tint ink — the sheet's item row. */
function ItemRow({
  name,
  bin,
  onPress,
  accessibilityLabel,
  recessed,
}: {
  name: string;
  bin: BinType;
  onPress: () => void;
  accessibilityLabel: string;
  /** Idle recents sit on `card2`; live results on `card`. */
  recessed?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.surface : recessed ? theme.card2 : theme.card,
          borderColor: theme.line,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Lid bin={bin} />
      <Text style={[TYPE.row, styles.rowName, { color: theme.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[TYPE.rowBin, { color: theme.bins[bin].tintInk }]}>{BIN_SHORT_LABEL[bin]}</Text>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { theme } = useTheme();
  const rules = useRegionRules();
  const router = useRouter();
  const history = useScanHistory(20);

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

  // The most recent distinct items scanned — "asked here before". Keyed by item so a run of
  // the same bottle shows once.
  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: { itemKey: string; bin: BinType }[] = [];
    for (const scan of history.data?.scans ?? []) {
      if (seen.has(scan.item_name)) continue;
      seen.add(scan.item_name);
      out.push({ itemKey: scan.item_name, bin: scan.bin_result });
      if (out.length === RECENTS) break;
    }
    return out;
  }, [history.data]);

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

  const renderRow = ({ item: hit }: { item: ItemHit }) => (
    <ItemRow
      name={hit.item.display_name}
      bin={hit.item.bin}
      onPress={() => openItem(hit.itemKey)}
      accessibilityLabel={`${hit.item.display_name}, ${BIN_SHORT_LABEL[hit.item.bin]}`}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View key="header" style={styles.header}>
        <Wordmark />
        <LocationChip />
      </View>

      {!active && (
        <Text key="heading" style={[TYPE.h2, styles.heading, { color: theme.text }]}>
          Try searching for an item
        </Text>
      )}

      {/* The field stays a stable direct child of this container in both states, so the
          idle→active swap never remounts it and the keyboard survives the transition. */}
      <View
        key="field"
        style={[styles.fieldRow, { backgroundColor: theme.card, borderColor: theme.lineStrong }]}
      >
        <SearchGlyph size={19} color={theme.accent} />
        <TextInput
          style={[TYPE.body, styles.field, { color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setEngaged(true)}
          onSubmitEditing={submit}
          placeholder="Type it, or scan it"
          placeholderTextColor={theme.text2}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {active && (
          <Pressable
            style={[styles.clearButton, { backgroundColor: theme.surface }]}
            onPress={clear}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <CloseGlyph size={12} color={theme.text} />
          </Pressable>
        )}
      </View>

      {!active && (
        <View key="idle" style={styles.idle}>
          {recents.length > 0 && (
            <View style={styles.recents}>
              <Text style={[TYPE.micro, { color: theme.text2 }]}>Asked here before</Text>
              {recents.map((r) => (
                <ItemRow
                  key={r.itemKey}
                  name={getItemDisplayName(rules, r.itemKey)}
                  bin={r.bin}
                  onPress={() => openItem(r.itemKey)}
                  accessibilityLabel={`${getItemDisplayName(rules, r.itemKey)}, ${BIN_SHORT_LABEL[r.bin]}`}
                  recessed
                />
              ))}
            </View>
          )}

          <View style={styles.pinned}>
            <Button
              label="Scan it instead"
              size="lg"
              block
              icon={({ color, size }) => <CameraGlyph color={color} size={size} />}
              onPress={() => router.navigate("/")}
            />
          </View>
        </View>
      )}

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
            <Text style={[TYPE.small, styles.empty, { color: theme.text2 }]}>
              {query.trim() === ""
                ? "Start typing — a few letters is enough."
                : `Nothing here matches “${query.trim()}”. Try the material: “paper cup”, not “latte”.`}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
  },
  heading: { paddingHorizontal: 22, marginBottom: 20 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.chip,
    borderWidth: 1,
    paddingHorizontal: 20,
    marginHorizontal: 22,
    gap: 10,
  },
  field: { flex: 1, paddingVertical: 14 },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: radii.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  idle: { flex: 1, paddingHorizontal: 22, paddingTop: 20 },
  recents: { gap: 9 },
  pinned: { marginTop: "auto", gap: 10, paddingBottom: 16 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowGap: { height: 9 },
  rowName: { flex: 1 },
  empty: { paddingTop: 8 },
});
