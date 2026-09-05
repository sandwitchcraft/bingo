/**
 * The scan result: a draggable bottom sheet that rises when `scanResult.tsx` has an active
 * item, showing the item, its bin, and any handling notes from the region rules.
 *
 * Mounted once in the root layout (not per-screen), so it can be raised from anywhere —
 * the Scan tab commits a detection, Settings' dev "sort a random item" does too.
 *
 * Two snap positions, collapsed and expanded, driven by a Reanimated shared value with a
 * `COLLAPSED_HEIGHT` / `SNAP_THRESHOLD` pair below. Note the visibility-only effect further
 * down: its dep array is hand-maintained, since this project has no `exhaustive-deps` lint.
 */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ResultView } from "@/features/scan/ResultView";
import { useScanResult } from "@/features/scan/scanResult";
import { useTheme } from "@/ui/theme";

const COLLAPSED_HEIGHT = 320; // visible content height when collapsed
const SNAP_THRESHOLD = 60; // drag travel to switch snap state
const SHEET_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export function ScanResultSheet() {
  const { activeItemKey, dismiss } = useScanResult();
  const { theme } = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const collapsedTop = height - COLLAPSED_HEIGHT;
  // Expanded stops below the status bar rather than at 0, so the sheet's rounded
  // top edge and handle stay clear of the notch. Height is sized to match, so the
  // bottom of the sheet lands exactly on the bottom of the screen when expanded.
  const expandedTop = insets.top;
  const sheetHeight = height - expandedTop;

  // top position of the sheet; starts off-screen.
  const top = useSharedValue(height);
  const startTop = useSharedValue(height);

  // JS-side flag: only intercept scrim touches when the sheet is expanded, so a
  // collapsed sheet's transparent scrim doesn't block the tab bar underneath.
  const [expanded, setExpanded] = useState(false);

  const visible = activeItemKey !== null;

  useEffect(() => {
    if (visible) {
      top.value = withTiming(collapsedTop, { duration: 350, easing: SHEET_EASING });
    } else {
      top.value = withTiming(height, { duration: 300, easing: SHEET_EASING });
    }
    setExpanded(false);
    // Visibility only: collapsedTop / height track window size, and re-running this
    // when they change would re-animate the sheet on every rotation or resize.
  }, [visible]);

  const close = () => {
    setExpanded(false);
    top.value = withTiming(height, { duration: 300, easing: SHEET_EASING }, (finished) => {
      if (finished) runOnJS(dismiss)();
    });
  };

  const snapTo = (target: number, nextExpanded: boolean) => {
    "worklet";
    runOnJS(setExpanded)(nextExpanded);
    top.value = withTiming(target, { duration: 350, easing: SHEET_EASING });
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startTop.value = top.value;
    })
    .onUpdate((e) => {
      const next = startTop.value + e.translationY;
      top.value = Math.min(Math.max(next, expandedTop), height);
    })
    .onEnd((e) => {
      const movedDown = e.translationY > SNAP_THRESHOLD;
      const movedUp = e.translationY < -SNAP_THRESHOLD;
      const nearCollapsed = startTop.value > collapsedTop - SNAP_THRESHOLD;

      if (movedUp) {
        snapTo(expandedTop, true);
      } else if (movedDown) {
        if (nearCollapsed) {
          // dragging down from collapsed dismisses the sheet
          runOnJS(setExpanded)(false);
          top.value = withTiming(height, { duration: 300, easing: SHEET_EASING }, (finished) => {
            if (finished) runOnJS(dismiss)();
          });
        } else {
          snapTo(collapsedTop, false);
        }
      } else {
        // didn't cross the threshold: snap to whichever state is nearer
        const nearest =
          top.value < (expandedTop + collapsedTop) / 2 ? expandedTop : collapsedTop;
        snapTo(nearest, nearest === expandedTop);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    top: top.value,
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(top.value, [expandedTop, collapsedTop], [1, 0], "clamp"),
  }));

  if (!visible || !activeItemKey) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scrim — only intercepts touches while expanded */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, scrimStyle]}
        pointerEvents={expanded ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetHeight, backgroundColor: theme.bgAlt, borderColor: theme.cardBorder },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.handleZone}>
            <View style={[styles.handleBar, { backgroundColor: theme.handleBar }]} />
          </View>
        </GestureDetector>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Shared with the full-screen search result (app/item.tsx) so the two are
              identical. The only context-specific action is the left button — here it
              closes the sheet to scan again; on the search screen it goes back to search. */}
          <ResultView
            itemKey={activeItemKey}
            primaryActionLabel="Scan another"
            onPrimaryAction={close}
            onViewHistory={() => {
              close();
              router.push("/history");
            }}
            context="scan"
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
  },
  handleZone: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: "center",
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: 24,
    gap: 16,
  },
});
