/**
 * The place you're in, as a pill: the active place's label ("Home") — or the region's name
 * when no saved place matches the selected region — and a chevron. It sits in the header of
 * every screen that gives an answer, because the place changes every answer below it.
 * Tapping it raises the places sheet (`PlacesSheet.tsx`), the dropdown for switching; from a
 * result screen it passes the item along so the sheet can preview each place's bin.
 *
 * `onDark` renders the scan screen's variant — translucent sand over the permanently dark
 * viewfinder — since that surface ignores the active theme.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { usePlaces } from "@/features/region/placesStore";
import { getRegionName } from "@/features/region/regionData";
import { useRegionRules } from "@/features/region/regionStore";
import { ChevronDownGlyph } from "@/ui/Icons";
import { radii, scanSurface, TYPE, useTheme } from "@/ui/theme";

type Props = {
  onDark?: boolean;
  /** Renders as a static label rather than a button. */
  static?: boolean;
  /**
   * On a result screen, the item being looked at. The places sheet then shows the bin that
   * item lands in at each place, so the user can re-sort it for somewhere else.
   */
  itemKey?: string;
};

export function LocationChip({ onDark = false, static: isStatic = false, itemKey }: Props) {
  const { theme } = useTheme();
  const rules = useRegionRules();
  const { activePlace, openSheet } = usePlaces();
  const regionName = getRegionName(rules);
  const label = activePlace?.label ?? regionName;

  const textColor = onDark ? scanSurface.text : theme.text;

  const body = (pressed: boolean) => (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: onDark
            ? pressed
              ? scanSurface.chipPressed
              : scanSurface.chip
            : pressed
              ? theme.accentTint
              : theme.surface,
        },
      ]}
    >
      <Text style={[TYPE.chip, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      {!isStatic && <ChevronDownGlyph size={14} color={textColor} />}
    </View>
  );

  if (isStatic) return body(false);

  return (
    <Pressable
      onPress={() => openSheet(itemKey)}
      accessibilityRole="button"
      accessibilityLabel={`Sorting for ${label}, ${regionName}. Switch place`}
      hitSlop={6}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    maxWidth: 220,
  },
});
