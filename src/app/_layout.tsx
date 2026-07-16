import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from "@expo-google-fonts/ibm-plex-mono";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ScanResultSheet } from "@/components/ScanResultSheet";
import { ScanResultProvider } from "@/lib/scanResult";
import { resolveTheme, THEMES, ThemeContext, type ThemePreference } from "@/lib/theme";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_400Regular,
    Inter_600SemiBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  // Re-renders when the OS scheme changes, so "system" tracks it live rather than
  // only at launch. app.json sets userInterfaceStyle "automatic", without which this
  // would report light forever.
  const systemScheme = useColorScheme();

  const [preference, setPreference] = useState<ThemePreference>("system");
  const themeName = resolveTheme(preference, systemScheme);

  const themeValue = useMemo(
    () => ({
      name: themeName,
      theme: THEMES[themeName],
      preference,
      setPreference,
    }),
    [themeName, preference],
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
