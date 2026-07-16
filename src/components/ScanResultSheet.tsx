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

import { BIN_STYLE } from "@/lib/bins";
import { formatItemName, getBinForItem, getItemEmoji } from "@/lib/regionData";
import { useScanResult } from "@/lib/scanResult";
import { FONT, useTheme } from "@/lib/theme";

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
  const expandedTop = 0;

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
    // collapsedTop / height depend on window size; intentionally re-run on visibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const result = getBinForItem(activeItemKey);
  if (!result) return null;

  const bin = BIN_STYLE[result.bin];
  const emoji = getItemEmoji(activeItemKey);
  const itemName = formatItemName(activeItemKey);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scrim — only intercepts touches while expanded */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
        pointerEvents={expanded ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { height, backgroundColor: theme.card, borderColor: theme.cardBorder },
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
          {/* Item header */}
          <View style={styles.itemHeader}>
            <Text style={styles.itemEmoji}>{emoji}</Text>
            <View style={styles.itemHeaderText}>
              <Text style={[styles.eyebrow, { color: theme.textMuted }]}>Identified Item</Text>
              <Text style={[styles.itemName, { color: theme.text }]}>{itemName}</Text>
            </View>
          </View>

          {/* Bin badge card */}
          <View style={[styles.binCard, { backgroundColor: bin.dark.bg, borderColor: bin.dark.border }]}>
            <Text style={styles.binEmoji}>{bin.emoji}</Text>
            <View style={styles.binText}>
              <Text style={[styles.binEyebrow, { color: bin.dark.text }]}>Sort Into</Text>
              <Text style={[styles.binLabel, { color: bin.dark.text }]}>{bin.label}</Text>
              <Text style={[styles.binDesc, { color: bin.dark.text }]}>{result.notes}</Text>
            </View>
          </View>

          {/* Why? detail card */}
          <View style={[styles.whyCard, { backgroundColor: theme.bgInput, borderColor: theme.cardBorder }]}>
            <Text style={[styles.eyebrow, { color: theme.textMuted }]}>Why?</Text>
            <Text style={[styles.whyBody, { color: theme.textBody }]}>{result.notes}</Text>
          </View>

          {/* Consult-guide link */}
          {result.link && (
            <Pressable
              style={[styles.linkRow, { borderColor: bin.dark.border }]}
              onPress={() => WebBrowser.openBrowserAsync(result.link!)}
            >
              <Text style={[styles.linkText, { color: bin.dark.text }]}>
                View local disposal guide ↗
              </Text>
            </Pressable>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { backgroundColor: theme.bgInput, borderColor: theme.cardBorder }]}
              onPress={close}
            >
              <Text style={[styles.btnText, { color: theme.primary }]}>Scan another</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
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
            <Text style={[styles.reportText, { color: theme.textMuted }]}>ⓘ Report incorrect sort</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: "rgba(0,0,0,0.6)" },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  itemEmoji: { fontSize: 44 },
  itemHeaderText: { flex: 1 },
  eyebrow: {
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  itemName: {
    fontFamily: FONT.semibold,
    fontSize: 24,
    marginTop: 2,
  },
  binCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  binEmoji: { fontSize: 30 },
  binText: { flex: 1 },
  binEyebrow: {
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    opacity: 0.7,
  },
  binLabel: {
    fontFamily: FONT.semibold,
    fontSize: 20,
    marginTop: 2,
  },
  binDesc: {
    fontFamily: FONT.regular,
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  whyCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  whyBody: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  linkRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  linkText: { fontFamily: FONT.medium, fontSize: 14 },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { fontFamily: FONT.medium, fontSize: 14 },
  reportRow: { alignItems: "center", paddingVertical: 4 },
  reportText: { fontFamily: FONT.regular, fontSize: 14 },
});
