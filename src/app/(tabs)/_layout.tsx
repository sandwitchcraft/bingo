import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HistoryIcon, ScanIcon, SettingsIcon } from "@/components/TabIcons";
import { accent, FONT, useTheme } from "@/lib/theme";

type TabDef = {
  name: string;
  label: string;
  Icon: (props: { size: number; color: string }) => React.ReactElement;
  size: number;
};

// Spec order: History (left), Scan (center), Settings (right).
const TAB_ORDER: TabDef[] = [
  { name: "history", label: "History", Icon: HistoryIcon, size: 22 },
  { name: "index", label: "Scan", Icon: ScanIcon, size: 30 },
  { name: "settings", label: "Settings", Icon: SettingsIcon, size: 22 },
];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme, name: themeName } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.navBg,
          borderTopColor: theme.navBorder,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {TAB_ORDER.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        const routeIndex = state.routes.indexOf(route);
        const focused = state.index === routeIndex;
        const color = focused ? accent[themeName] : theme.textMuted;

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
          <Pressable key={tab.name} style={styles.tab} onPress={onPress}>
            <tab.Icon size={tab.size} color={color} />
            <Text
              style={[
                styles.label,
                { color, fontFamily: focused ? FONT.utilityStrong : FONT.utility },
              ]}
            >
              {tab.label}
            </Text>
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
      <Tabs.Screen name="history" />
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
    paddingBottom: 12,
    gap: 4,
  },
  label: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
});
