import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { colors, FONT, radii } from "@/lib/theme";
import { useToast, type Toast } from "@/lib/toast";

const VISIBLE_MS = 5_000;
const TOAST_EASING = Easing.bezier(0.32, 0.72, 0, 1);

/** Matches the item pictograms: single-weight line on a 24px grid, round caps. */
function WarningIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 3.6 2.7 19.4a1.4 1.4 0 0 0 1.2 2.1h16.2a1.4 1.4 0 0 0 1.2-2.1z" />
      <Path d="M12 9.4v4.6" />
      <Path d="M12 17.6h.01" />
    </Svg>
  );
}

/**
 * The error banner. Mounted once at the root above the router, so it floats over whatever
 * screen is up — including the scan result sheet, which is why it sits after the sheet in
 * the tree rather than before it.
 *
 * Fixed to the top rather than the bottom on purpose: the bottom of the screen is the tab
 * bar and the result sheet's travel path, and a notification that lands on top of either
 * would either be covered or block a control mid-gesture.
 */
export function ErrorToast() {
  const { toast, dismissToast } = useToast();
  const insets = useSafeAreaInsets();

  // The message has to outlive `toast` going null, or the text would vanish the instant
  // dismissal starts and the banner would animate out empty.
  const [shown, setShown] = useState<Toast | null>(null);

  const progress = useSharedValue(0);
  // How far up to park it when hidden — measured, since a two-line message is taller than
  // a one-line one and a fixed guess would leave a sliver of red on screen.
  const hiddenOffset = useSharedValue(200);

  const visible = toast !== null;

  useEffect(() => {
    if (toast) setShown(toast);
  }, [toast]);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 280 : 200,
      easing: TOAST_EASING,
    });
    if (!visible) return;
    // Restarts on every new error (hence `toast?.id` below): a second failure arriving at
    // 4.9s should get its own five seconds, not the tail of the first one's.
    const timer = setTimeout(dismissToast, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, toast?.id, dismissToast, progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    hiddenOffset.value = event.nativeEvent.layout.height + insets.top + 24;
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-hiddenOffset.value, 0]) }],
    opacity: progress.value,
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <Animated.View style={animatedStyle} onLayout={onLayout} pointerEvents={visible ? "auto" : "none"}>
        <Pressable
          style={styles.banner}
          onPress={dismissToast}
          accessibilityRole="alert"
          accessibilityLabel={shown?.message}
          accessibilityHint="Tap to dismiss"
        >
          <WarningIcon size={20} color={colors.white} />
          <Text style={styles.message}>{shown?.message ?? ""}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.alert,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    // Same fill in both themes: an error reads as an error, not as a themed surface.
    shadowColor: colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  message: {
    flex: 1,
    fontFamily: FONT.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.white,
  },
});
