/**
 * Add (or edit) a place — pushed from the Location tab. A place is a label you'd actually
 * say ("Home", "Cottage") pinned to one region's rules. Saving downloads the region if it
 * isn't on disk yet, switches to it, and pops back to the Location tab.
 *
 * Top to bottom: the label field with a row of suggestions, then the region list (search,
 * Residential/Commercial segment, and "Use my location" to pick the region under you), then
 * the Save button pinned to the bottom. Pass `?placeId=` to edit an existing place instead:
 * the fields pre-fill and Save updates in place (a region change on the active place switches
 * the rules in use).
 *
 * This is the only screen that shows the full region catalog. The list is flat and ordered
 * catalog-first with the current selection on top; there are no download or favourite
 * controls — a place is the reason rules are on disk, so downloading is a side effect of
 * saving, never a separate gesture.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getString, setString, StorageKeys } from "@/core/storage";
import { detectRegion, locationErrorMessage } from "@/features/region/location";
import { PLACE_LABEL_SUGGESTIONS, usePlaces } from "@/features/region/placesStore";
import {
  BUNDLED_REGION_ID,
  regionSubtitle,
  type ProviderType,
  type RegionSummary,
} from "@/features/region/regionSource";
import { useRegion } from "@/features/region/regionStore";
import { Button } from "@/ui/Button";
import { CheckGlyph, ChevronLeftGlyph, LocateGlyph, SearchGlyph } from "@/ui/Icons";
import { radii, TYPE, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

/** The two provider categories, in segment order. `value` is the wire `ProviderType`. */
const CATEGORY_SEGMENTS: { value: ProviderType; label: string }[] = [
  { value: "municipal", label: "Residential" },
  { value: "commercial", label: "Commercial" },
];

/**
 * Coerce a possibly-missing category to a valid one, defaulting to residential. Rules cached
 * before `provider_type` existed read back `undefined`, which would leave the segment matching
 * neither option — this keeps a category always selected.
 */
function normalizeCategory(value: unknown): ProviderType {
  return value === "commercial" ? "commercial" : "municipal";
}

/**
 * True when `prefix` is an ordered prefix of `full` — i.e. a provider's geographic scope
 * covers the reference location. `["canada","ontario"]` covers `["canada","ontario","halton"]`.
 */
function isPrefixPath(prefix: string[], full: string[]): boolean {
  return prefix.length <= full.length && prefix.every((seg, i) => seg === full[i]);
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

/** A surface track holding pill segments; the selected one is raised to card. */
function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: ProviderType; label: string }[];
  value: ProviderType;
  onChange: (value: ProviderType) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: theme.surface }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segmentItem,
              active && { backgroundColor: theme.card, borderColor: theme.lineStrong },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Show ${opt.label.toLowerCase()} providers`}
          >
            <Text style={[styles.segmentLabel, { color: active ? theme.accentInk : theme.text2 }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AddPlaceScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { showError } = useToast();
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const { rules, catalog, catalogIsFallback, selectedId } = useRegion();
  const { places, addPlace, updatePlace } = usePlaces();

  const editing = placeId ? (places ?? []).find((p) => p.id === placeId) ?? null : null;

  const [label, setLabel] = useState(editing?.label ?? "");
  // The region this place will point at. Editing starts on the place's own region; a new
  // place starts unselected so the Save button says what's missing.
  const [regionId, setRegionId] = useState<string | null>(editing?.regionId ?? null);
  const [query, setQuery] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Which provider category the list is showing. Seeds from the chosen region's category (or
  // the active rules'), then the saved preference is restored; every change persists it.
  const [viewCategory, setViewCategoryState] = useState<ProviderType>(() =>
    normalizeCategory(
      editing ? catalog.find((e) => e.id === editing.regionId)?.providerType : rules.provider_type,
    ),
  );
  const categoryTouched = useRef(false);
  const setViewCategory = (category: ProviderType) => {
    categoryTouched.current = true;
    setViewCategoryState(category);
    setString(StorageKeys.regionPickerCategory, category).catch(() => {});
  };
  useEffect(() => {
    if (editing) return; // an edit opens on its own region's category, not the remembered one
    getString(StorageKeys.regionPickerCategory)
      .then((saved) => {
        if (categoryTouched.current || (saved !== "municipal" && saved !== "commercial")) return;
        setViewCategoryState(saved);
      })
      .catch(() => {});
  }, [editing]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (region: RegionSummary) =>
      needle === "" ||
      [region.displayName, region.providerName ?? "", ...region.parents, ...region.path]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    const inCategory = catalog.filter((r) => r.providerType === viewCategory && matches(r));

    // The chosen region first, then (commercial only) haulers that serve the active region's
    // area, then catalog order.
    const referencePath = catalog.find((e) => e.id === selectedId)?.path ?? rules.location_path;
    const tierOf = (region: RegionSummary): number => {
      if (region.id === regionId) return 0;
      if (viewCategory === "commercial" && isPrefixPath(region.path, referencePath)) return 1;
      return 2;
    };
    const buckets: RegionSummary[][] = [[], [], []];
    for (const region of inCategory) buckets[tierOf(region)].push(region);
    return buckets.flat();
  }, [catalog, query, regionId, rules, selectedId, viewCategory]);

  const chosen = regionId ? catalog.find((e) => e.id === regionId) ?? null : null;
  const trimmedLabel = label.trim();
  const canSave = trimmedLabel !== "" && chosen !== null && !saving;

  // GPS → Nominatim → a region in the catalog, selected in the list (not yet saved). Only on
  // Residential: detection resolves a place to its municipal collection, never a hauler.
  const detect = () => {
    if (detecting) return;
    setDetecting(true);
    detectRegion(catalog)
      .then((match) => {
        setViewCategory("municipal");
        setRegionId(match.id);
        setQuery("");
      })
      .catch((error: unknown) => {
        console.warn("[places] location detection failed", error);
        showError(locationErrorMessage(error));
      })
      .finally(() => setDetecting(false));
  };

  const save = () => {
    if (!canSave || !chosen) return;
    Keyboard.dismiss();
    setSaving(true);
    const op = editing ? updatePlace(editing.id, trimmedLabel, chosen) : addPlace(trimmedLabel, chosen);
    op.then(() => router.back()).catch((error: unknown) => {
      console.warn("[places] failed to save place", error);
      showError(`Couldn't save ${trimmedLabel}. ${chosen.displayName}'s rules wouldn't download — check your connection.`);
      setSaving(false);
    });
  };

  const renderRow = ({ item }: { item: RegionSummary }) => {
    const isChosen = item.id === regionId;
    const isBundled = item.id === BUNDLED_REGION_ID;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: isChosen ? theme.accentTint : pressed ? theme.surface : theme.card,
            borderColor: isChosen ? theme.accent : theme.line,
          },
        ]}
        onPress={() => setRegionId(item.id)}
        accessibilityRole="radio"
        accessibilityState={{ checked: isChosen }}
      >
        <View style={styles.rowText}>
          <Text style={[TYPE.title, { color: theme.text }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={[TYPE.micro, { color: theme.text2 }]} numberOfLines={1}>
            {isBundled && "BUILT IN · "}
            {item.providerType === "commercial" && "COMMERCIAL · "}
            {regionSubtitle(item)}
          </Text>
        </View>
        {isChosen && <CheckGlyph size={21} color={theme.accentStrong} />}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        ItemSeparatorComponent={RowGap}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={({ pressed }) => [
                  styles.back,
                  { borderColor: theme.lineStrong, backgroundColor: pressed ? theme.surface : "transparent" },
                ]}
              >
                <ChevronLeftGlyph size={18} color={theme.text} />
              </Pressable>
            </View>
            <Text style={[TYPE.h2, { color: theme.text }]}>{editing ? "Edit place" : "Add a place"}</Text>
            <Text style={[TYPE.bodySm, { color: theme.text2 }]}>
              Name it the way you'd say it, then pick whose rules apply there.
            </Text>

            <Text style={[TYPE.micro, styles.fieldLabel, { color: theme.text2 }]}>Name</Text>
            <TextInput
              style={[TYPE.body, styles.field, { backgroundColor: theme.card, borderColor: theme.lineStrong, color: theme.text }]}
              value={label}
              onChangeText={setLabel}
              placeholder="Home"
              placeholderTextColor={theme.text2}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              maxLength={32}
            />
            <View style={styles.suggestions}>
              {PLACE_LABEL_SUGGESTIONS.map((s) => {
                const active = trimmedLabel === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setLabel(s)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.suggestion,
                      {
                        backgroundColor: active ? theme.accentTint : pressed ? theme.surface : "transparent",
                        borderColor: active ? theme.accent : theme.line,
                      },
                    ]}
                  >
                    <Text style={[TYPE.tag, { color: active ? theme.accentInk : theme.text2 }]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.regionHeading}>
              <Text style={[TYPE.micro, { color: theme.text2 }]}>Rules that apply</Text>
              <SegmentedControl options={CATEGORY_SEGMENTS} value={viewCategory} onChange={setViewCategory} />
            </View>
            <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.lineStrong }]}>
              <SearchGlyph size={18} color={theme.accent} />
              <TextInput
                style={[TYPE.body, styles.searchField, { color: theme.text }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search regions"
                placeholderTextColor={theme.text2}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
            {viewCategory === "municipal" && (
              <Pressable
                style={({ pressed }) => [
                  styles.detectButton,
                  { borderColor: theme.lineStrong },
                  pressed && { backgroundColor: theme.accentTint },
                ]}
                onPress={detect}
                disabled={detecting}
                accessibilityRole="button"
                accessibilityLabel="Pick the region at my current location"
                accessibilityState={{ busy: detecting }}
              >
                {detecting ? (
                  <ActivityIndicator size="small" color={theme.accentStrong} />
                ) : (
                  <>
                    <LocateGlyph size={20} color={theme.accentStrong} />
                    <Text style={[TYPE.title, { fontSize: 16, color: theme.accentStrong }]}>Use my location</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={[TYPE.small, styles.empty, { color: theme.text2 }]}>
            {query.trim()
              ? `No regions match “${query.trim()}”.`
              : viewCategory === "commercial"
                ? "No commercial providers are listed yet. Reconnect to check for the latest."
                : "No residential regions are available."}
          </Text>
        }
        ListFooterComponent={
          catalogIsFallback ? (
            <Text style={[TYPE.small, styles.footer, { color: theme.text2 }]}>
              Showing the regions included with the app — the full list couldn’t be downloaded.
              Reconnect and reopen this screen to see everything available.
            </Text>
          ) : null
        }
      />

      <View style={[styles.pinned, { backgroundColor: theme.bg, borderTopColor: theme.line }]}>
        <Button
          label={
            !chosen
              ? "Pick a region to save"
              : trimmedLabel === ""
                ? "Name this place to save"
                : editing
                  ? "Save changes"
                  : `Save ${trimmedLabel}`
          }
          size="lg"
          block
          disabled={!canSave}
          busy={saving}
          onPress={save}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 22, paddingBottom: 24 },
  header: { paddingTop: 10, paddingBottom: 12, gap: 10 },
  headerTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  back: {
    width: 38,
    height: 38,
    borderRadius: radii.chip,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: { marginTop: 14 },
  field: {
    borderRadius: radii.chip,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.chip,
    borderWidth: 1,
  },
  regionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
  },
  segment: { flexDirection: "row", borderRadius: radii.chip, padding: 3 },
  // The raised segment carries a hairline too (as Settings' does): card-on-surface alone is
  // too little contrast in dark mode.
  segmentItem: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentLabel: { ...TYPE.tag, fontSize: 13, lineHeight: 16 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.chip,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  searchField: { flex: 1, paddingVertical: 13 },
  detectButton: {
    minHeight: 54,
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 17,
    paddingVertical: 15,
    gap: 12,
  },
  rowGap: { height: 9 },
  rowText: { flexShrink: 1, gap: 3 },
  empty: { paddingTop: 8 },
  footer: { marginTop: 18 },
  pinned: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1 },
});
