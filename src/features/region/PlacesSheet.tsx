/**
 * The places dropdown: a small bottom sheet listing the user's saved places, raised from the
 * location chip on any screen. Tap a place to switch the rules in use; the last row goes to
 * the Location tab to manage them. Mounted once at the root (under the report sheet and the
 * toast) with its open state in `placesStore`.
 *
 * Opened from a result (the chip passes `itemKey`), each row also shows the bin that item
 * lands in at that place — read from the place's cached rules, which are on disk because
 * saving the place downloaded them. That's the payoff: "at the cottage this goes in garbage".
 *
 * Deliberately lighter than the result/report sheets: no drag handle or snap points — it's a
 * menu, so the scrim tap and a row tap are the only ways out.
 */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BIN_SHORT_LABEL, type BinType } from "@/core/bins";
import { usePlaces, type Place } from "@/features/region/placesStore";
import { resolveScanResult } from "@/features/region/regionData";
import { readCachedRules } from "@/features/region/regionSource";
import { useRegion } from "@/features/region/regionStore";
import { CheckGlyph, PlusGlyph } from "@/ui/Icons";
import { Lid } from "@/ui/Lid";
import { radii, TYPE, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const EASING = Easing.bezier(0.32, 0.72, 0, 1);

export function PlacesSheet() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showError } = useToast();
  const { catalog, rules, selectedId } = useRegion();
  const { places, activePlaceId, switchPlace, sheetOpen, sheetItemKey, closeSheet } = usePlaces();

  const [busyId, setBusyId] = useState<string | null>(null);

  // Region id → the bin `sheetItemKey` lands in there. The active region resolves from live
  // rules; the others read their cached copy (a place's rules are always on disk).
  const [binByRegion, setBinByRegion] = useState<Record<string, BinType>>({});
  useEffect(() => {
    if (!sheetOpen || !sheetItemKey || !places) return;
    let cancelled = false;
    const itemKey = sheetItemKey;
    const regionIds = [...new Set(places.map((p) => p.regionId))];
    Promise.all(
      regionIds.map(async (regionId) => {
        const regionRules = regionId === selectedId ? rules : await readCachedRules(regionId);
        return [regionId, regionRules ? resolveScanResult(regionRules, itemKey).bin : null] as const;
      }),
    )
      .then((pairs) => {
        if (cancelled) return;
        const next: Record<string, BinType> = {};
        for (const [regionId, bin] of pairs) if (bin) next[regionId] = bin;
        setBinByRegion(next);
      })
      .catch((error: unknown) => console.warn("[places] bin preview failed", error));
    return () => {
      cancelled = true;
    };
  }, [sheetOpen, sheetItemKey, places, rules, selectedId]);

  // Slide from below; the sheet's own height is measured so it parks fully off screen.
  const [height, setHeight] = useState(400);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(sheetOpen ? 1 : 0, { duration: sheetOpen ? 260 : 200, easing: EASING });
  }, [sheetOpen, progress]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * (height + 40) }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const regionNameOf = (place: Place) =>
    catalog.find((entry) => entry.id === place.regionId)?.displayName ?? place.regionId;

  const choose = (place: Place) => {
    if (busyId) return;
    if (place.id === activePlaceId) {
      closeSheet();
      return;
    }
    setBusyId(place.id);
    switchPlace(place.id)
      .then(closeSheet)
      .catch((error: unknown) => {
        console.warn("[places] failed to switch place", error);
        showError(`Couldn't switch to ${place.label}. Its saved rules may be unavailable.`);
      })
      .finally(() => setBusyId(null));
  };

  const manage = () => {
    closeSheet();
    router.navigate("/region");
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={sheetOpen ? "box-none" : "none"}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, scrimStyle]}
        pointerEvents={sheetOpen ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel="Close" />
      </Animated.View>

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.line,
              shadowColor: theme.shadow,
              paddingBottom: insets.bottom + 18,
            },
            sheetStyle,
          ]}
          accessibilityViewIsModal={sheetOpen}
        >
          <Text style={[TYPE.micro, styles.eyebrow, { color: theme.text2 }]}>
            {sheetItemKey ? "Where would you sort this?" : "Sorting for"}
          </Text>

          <View style={styles.list}>
            {(places ?? []).map((place) => {
              const active = place.id === activePlaceId;
              const bin = sheetItemKey ? binByRegion[place.regionId] : undefined;
              return (
                <Pressable
                  key={place.id}
                  onPress={() => choose(place)}
                  disabled={busyId != null}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, busy: busyId === place.id }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: active ? theme.accentTint : pressed ? theme.surface : theme.card2,
                      borderColor: active ? theme.accent : theme.line,
                    },
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={[TYPE.title, { color: theme.text }]} numberOfLines={1}>
                      {place.label}
                    </Text>
                    <Text style={[TYPE.micro, { color: theme.text2 }]} numberOfLines={1}>
                      {regionNameOf(place)}
                    </Text>
                  </View>
                  {bin && (
                    <View style={styles.binPreview}>
                      <Lid bin={bin} width={8} height={20} />
                      <Text style={[TYPE.rowBin, { color: theme.bins[bin].tintInk }]}>
                        {BIN_SHORT_LABEL[bin]}
                      </Text>
                    </View>
                  )}
                  {active && <CheckGlyph size={21} color={theme.accentStrong} />}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={manage}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.manage,
              { borderColor: theme.lineStrong, backgroundColor: pressed ? theme.accentTint : "transparent" },
            ]}
          >
            <PlusGlyph size={18} color={theme.accentStrong} />
            <Text style={[TYPE.title, { fontSize: 16, color: theme.accentStrong }]}>Manage places</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radii.screen,
    borderTopRightRadius: radii.screen,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    gap: 14,
    shadowOpacity: 1,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: -14 },
    elevation: 12,
  },
  eyebrow: {},
  list: { gap: 9 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 17,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  rowText: { flex: 1, gap: 2 },
  binPreview: { flexDirection: "row", alignItems: "center", gap: 8 },
  manage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 4,
  },
});
