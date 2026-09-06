/**
 * The lid motif — the design system's only illustration. A bin is drawn as a rounded vertical
 * bar in its lid colour (8–12 wide, 20–36 tall, 3 radius); a row of them describes a region's
 * bin set. Use these instead of dots, badges or drawings of bins anywhere a bin outcome needs
 * a colour mark.
 */
import { View, type ViewStyle } from "react-native";

import type { BinType } from "@/core/bins";
import { lid, useTheme } from "@/ui/theme";

type LidProps = {
  bin: BinType;
  height?: number;
  width?: number;
  /** Overrides the theme's fill — for the fixed-dark scan screen. */
  color?: string;
  style?: ViewStyle;
};

export function Lid({ bin, height = lid.height, width = lid.width, color, style }: LidProps) {
  const { theme } = useTheme();
  return (
    <View
      accessible={false}
      style={[
        { width, height, borderRadius: lid.radius, backgroundColor: color ?? theme.bins[bin].fill },
        style,
      ]}
    />
  );
}

type LidStackProps = {
  bins: readonly BinType[];
  height?: number;
  width?: number;
  style?: ViewStyle;
};

/** A region's bin set as a row of lids, in the order given. */
export function LidStack({
  bins,
  height = lid.stackHeight,
  width = lid.stackWidth,
  style,
}: LidStackProps) {
  return (
    <View style={[{ flexDirection: "row", gap: lid.stackGap }, style]} accessible={false}>
      {bins.map((bin) => (
        <Lid key={bin} bin={bin} height={height} width={width} />
      ))}
    </View>
  );
}
