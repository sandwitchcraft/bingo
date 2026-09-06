/**
 * The three buttons on the sheet, all full pills in Bricolage 600.
 *
 * - `primary`: accent fill, `onAccent` text. One per screen, pinned to the bottom when it's
 *   the screen's main action. Pressed moves one step along the ramp (`accentStrong`).
 * - `secondary`: transparent with a `lineStrong` hairline, `text` ink. Pressed takes a
 *   `surface` fill.
 * - `tonal`: solid `surface` (beige) fill, `text` ink — the quieter half of a two-button row.
 *   Pressed deepens to `accentTint`.
 * - `ghost`: bare `accentStrong` text. Pressed takes an `accentTint` fill.
 *
 * Disabled drops to 45% opacity. Motion is colour only, and RN's Pressable handles that.
 */
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { radii, TYPE, useTheme } from "@/ui/theme";

type Variant = "primary" | "secondary" | "tonal" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = Omit<PressableProps, "style" | "children"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  /** Stretch to the row. */
  block?: boolean;
  /** Leading glyph; receives the label colour via `color`. */
  icon?: (props: { color: string; size: number }) => ReactNode;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<Size, { paddingVertical: number; paddingHorizontal: number; fontSize: number; icon: number }> = {
  sm: { paddingVertical: 9, paddingHorizontal: 16, fontSize: 14, icon: 16 },
  md: { paddingVertical: 12, paddingHorizontal: 22, fontSize: 15, icon: 18 },
  lg: { paddingVertical: 16, paddingHorizontal: 26, fontSize: 17, icon: 20 },
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  block = false,
  icon,
  busy = false,
  disabled,
  style,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const dims = SIZES[size];
  const inactive = disabled || busy;

  const labelColor =
    variant === "primary"
      ? theme.onAccent
      : variant === "secondary" || variant === "tonal"
        ? theme.text
        : theme.accentStrong;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: dims.paddingVertical,
          // Ghost buttons sit tighter so they can hang off the end of a row.
          paddingHorizontal: variant === "ghost" ? Math.round(dims.paddingHorizontal / 2) : dims.paddingHorizontal,
        },
        variant === "primary" && { backgroundColor: pressed ? theme.accentStrong : theme.accent },
        variant === "secondary" && {
          borderWidth: 1,
          borderColor: theme.lineStrong,
          backgroundColor: pressed ? theme.surface : "transparent",
        },
        variant === "tonal" && { backgroundColor: pressed ? theme.accentTint : theme.surface },
        variant === "ghost" && { backgroundColor: pressed ? theme.accentTint : "transparent" },
        block && styles.block,
        inactive && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <>
          {icon?.({ color: labelColor, size: dims.icon })}
          <Text style={[TYPE.button, { fontSize: dims.fontSize, lineHeight: dims.fontSize + 4, color: labelColor }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radii.chip,
  },
  block: { alignSelf: "stretch" },
  disabled: { opacity: 0.45 },
});
