import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ScanResultSheet } from "@/components/ScanResultSheet";
import { ScanResultProvider } from "@/lib/scanResult";
import { THEMES, ThemeContext, type ThemeName } from "@/lib/theme";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const [themeName, setThemeName] = useState<ThemeName>("dark");

  const toggleTheme = useCallback(() => {
    setThemeName((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const themeValue = useMemo(
    () => ({
      name: themeName,
      theme: THEMES[themeName],
      setThemeName,
      toggleTheme,
    }),
    [themeName, toggleTheme],
  );

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContext.Provider value={themeValue}>
        <ScanResultProvider>
          <StatusBar style={themeName === "dark" ? "light" : "dark"} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
          <ScanResultSheet />
        </ScanResultProvider>
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}
