import { Text, type TextStyle } from "react-native";

import { FONT, useTheme } from "@/ui/theme";

type Props = {
  size?: number;
  color?: string;
  /** Overrides the interpunct's accent — for the fixed-dark scan screen. */
  dotColor?: string;
  style?: TextStyle;
};

/**
 * The bin·go wordmark: lowercase, Bricolage 700 tracked −0.03em, the interpunct in accent
 * green. The brand rule is enforced here rather than restated per screen — render this
 * component instead of typing the wordmark as a string anywhere.
 */
export function Wordmark({ size = 22, color, dotColor, style }: Props) {
  const { theme } = useTheme();

  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="bin-go"
      style={[
        {
          fontFamily: FONT.display,
          fontSize: size,
          lineHeight: Math.round(size * 1.05),
          color: color ?? theme.text,
          letterSpacing: -0.03 * size,
        },
        style,
      ]}
    >
      bin<Text style={{ color: dotColor ?? theme.accent }}>·</Text>go
    </Text>
  );
}
