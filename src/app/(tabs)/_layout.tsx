/**
 * The five-tab shell: Location, History, Scan, Search, Settings.
 *
 * The tab bar is hand-rendered rather than configured, because the spec's center Scan tab
 * (larger icon, center position) isn't something the default bar expresses. `TAB_ORDER`
 * below is the single place the order, labels and icons are declared.
 *
 * Styling follows the sheet: the bar is the page ground separated by a 1px `line`, the
 * active tab reads in accent green, labels are mono micro eyebrows.
 */
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HistoryIcon, LocationIcon, ScanIcon, SearchIcon, SettingsIcon } from "@/ui/TabIcons";
import { TYPE, useTheme } from "@/ui/theme";

type TabDef = {
  name: string;
  label: string;
  Icon: (props: { size: number; color: string }) => React.ReactElement;
  size: number;
};

// Order: Location and History (left), Scan and Search (the two large center tabs),
// Settings (right).
const TAB_ORDER: TabDef[] = [
  { name: "region", label: "Location", Icon: LocationIcon, size: 22 },
  { name: "history", label: "History", Icon: HistoryIcon, size: 22 },
  { name: "index", label: "Scan", Icon: ScanIcon, size: 28 },
  { name: "search", label: "Search", Icon: SearchIcon, size: 28 },
  { name: "settings", label: "Settings", Icon: SettingsIcon, size: 22 },
];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.bg,
          borderTopColor: theme.line,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {TAB_ORDER.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        const routeIndex = state.routes.indexOf(route);
        const focused = state.index === routeIndex;
        const color = focused ? theme.accent : theme.text2;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
          >
            <tab.Icon size={tab.size} color={color} />
            <Text style={[TYPE.micro, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="region" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    paddingBottom: 10,
    gap: 5,
  },
});
