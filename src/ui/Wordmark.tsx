import { Text, type TextStyle } from "react-native";

import { colors, FONT, useTheme } from "@/ui/theme";

type Props = {
  size?: number;
  color?: string;
  style?: TextStyle;
};

/**
 * The bin·go wordmark. The brand rule (lowercase, middle-dot separator, dot always
 * sprout) is enforced here rather than restated per screen — render this component
 * instead of typing the wordmark as a string anywhere.
 */
export function Wordmark({ size = 18, color, style }: Props) {
  const { theme } = useTheme();

  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="bin-go"
      style={[
        { fontFamily: FONT.display, fontSize: size, color: color ?? theme.text, letterSpacing: -0.2 },
        style,
      ]}
    >
      bin<Text style={{ color: colors.sprout }}>·</Text>go
    </Text>
  );
}
