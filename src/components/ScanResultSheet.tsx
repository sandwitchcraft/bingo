import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
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

import { BIN_LABEL, binColor, binSurface } from "@/lib/bins";
import { resolveScanResult } from "@/lib/regionData";
import { useRegionRules } from "@/lib/regionStore";
import { useScanResult } from "@/lib/scanResult";
import { FONT, radii, useTheme } from "@/lib/theme";

const COLLAPSED_HEIGHT = 320; // visible content height when collapsed
const SNAP_THRESHOLD = 60; // drag travel to switch snap state
const SHEET_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export function ScanResultSheet() {
  const { activeItemKey, dismiss } = useScanResult();
  const { theme } = useTheme();
  const rules = useRegionRules();
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

  const result = resolveScanResult(rules, activeItemKey);
  const surface = binSurface(result.bin);
  const accent = binColor(result.bin);
  // The region's own copy-edited name; resolveScanResult formats the key for items
  // the region doesn't list, so this is always populated.
  const itemName = result.display_name;

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
          {/* Item header. With no pictogram, the item name itself carries the outcome
              color — `accent` is the bin's color, so a recycling item reads Harbor,
              organics reads sprout, and so on. */}
          <View style={styles.itemHeader}>
            <Text style={[styles.eyebrow, { color: theme.textMuted }]}>Identified item</Text>
            <Text style={[styles.itemName, { color: accent }]}>{itemName}</Text>
          </View>

          {/* Bin outcome card */}
          <View style={[styles.binCard, { backgroundColor: surface.bg, borderColor: surface.border }]}>
            <Text style={[styles.eyebrow, { color: theme.textMuted }]}>Sort into</Text>
            <Text style={[styles.binLabel, { color: accent }]}>{BIN_LABEL[result.bin]}</Text>
          </View>

          {/* Handling detail */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.eyebrow, { color: theme.textMuted }]}>Why</Text>
            <Text style={[styles.body, { color: theme.textBody }]}>{result.description}</Text>
          </View>

          {/* Consult-guide link */}
          {result.link && (
            <Pressable
              style={[styles.linkRow, { borderColor: surface.border, backgroundColor: surface.bg }]}
              onPress={() => WebBrowser.openBrowserAsync(result.link!)}
            >
              <Text style={[styles.linkText, { color: accent }]}>View local disposal guide ↗</Text>
            </Pressable>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { backgroundColor: theme.secondaryBg }]}
              onPress={close}
            >
              <Text style={[styles.btnText, { color: theme.secondaryText }]}>Scan another</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: theme.primary }]}
              onPress={() => {
                dismiss();
                router.push("/history");
              }}
            >
              <Text style={[styles.btnText, { color: theme.primaryText }]}>View history</Text>
            </Pressable>
          </View>

          {/* Report (deferred wiring) */}
          <Pressable style={styles.reportRow} onPress={() => {}}>
            <Text style={[styles.reportText, { color: theme.textMuted }]}>Report incorrect sort</Text>
          </Pressable>
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
  itemHeader: {
    paddingTop: 4,
  },
  eyebrow: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  itemName: {
    fontFamily: FONT.display,
    fontSize: 26,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  binCard: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  binLabel: {
    fontFamily: FONT.heading,
    fontSize: 20,
    letterSpacing: -0.2,
    marginTop: 3,
  },
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  body: {
    fontFamily: FONT.body,
    fontSize: 14,
    lineHeight: 21,
  },
  linkRow: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  linkText: { fontFamily: FONT.utilityStrong, fontSize: 12 },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    borderRadius: radii.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { fontFamily: FONT.utilityStrong, fontSize: 12 },
  reportRow: { alignItems: "center", paddingVertical: 4 },
  reportText: { fontFamily: FONT.utility, fontSize: 11, letterSpacing: 0.2 },
});
