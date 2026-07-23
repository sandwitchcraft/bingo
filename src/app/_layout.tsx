/**
 * Root route. Everything the app renders is inside this tree.
 *
 * Its whole job is composition: load the brand fonts, hold the theme preference, mount the
 * provider stack (SQLite → scan settings → toast → region → scan result), and declare the
 * two top-level routes — the `(tabs)` group and the pushed `region` picker. The two pieces
 * of always-on UI that must float above every screen, `ScanResultSheet` and `ErrorToast`,
 * are mounted here rather than per-screen.
 *
 * Provider nesting order is load-bearing and each rung is commented inline below; the
 * SQLiteProvider memo note in particular is the reason theme state lives above it.
 */
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from "@expo-google-fonts/ibm-plex-mono";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DATABASE_NAME, DATABASE_OPTIONS, migrateDbAsync } from "@/features/history/db";
import { RegionProvider } from "@/features/region/regionStore";
import { ScanResultSheet } from "@/features/scan/ScanResultSheet";
import { ScanResultProvider } from "@/features/scan/scanResult";
import { ScanSettingsProvider } from "@/features/scan/scanSettings";
import { ErrorToast } from "@/ui/ErrorToast";
import { resolveTheme, THEMES, ThemeContext, type ThemePreference } from "@/ui/theme";
import { ToastProvider } from "@/ui/toast";

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
      {/* Anything that reads this component's state must sit ABOVE SQLiteProvider.
          SQLiteProvider is memo'd with a comparator that ignores `children`, so it
          freezes its subtree's elements: a themeValue passed down from here would
          never reach it. Context is exempt — React propagates it to consumers through
          memo boundaries — so useTheme() below still updates, and so does StatusBar
          as long as it stays out here where its props are re-evaluated. */}
      <ThemeContext.Provider value={themeValue}>
        <StatusBar style={themeName === "dark" ? "light" : "dark"} />
        {/* Wraps both the writer (ScanResultProvider) and the reader (History), and
            renders null until the database is open — the same gate this component
            applies to fontsLoaded. */}
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          options={DATABASE_OPTIONS}
          onInit={migrateDbAsync}
        >
          <ScanSettingsProvider>
            {/* Outermost of the app's own providers: anything below it, on any screen, can
                raise an error banner. */}
            <ToastProvider>
              {/* Above ScanResultProvider: recording a scan reads the active region's rules
                  for the bin outcome and the region name it stores. */}
              <RegionProvider>
                <ScanResultProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    {/* Not a tab — pushed from Settings, and the native stack's
                        slide-from-right is what gives it its reveal (and back-swipe). */}
                    <Stack.Screen name="region" options={{ animation: "slide_from_right" }} />
                  </Stack>
                  <ScanResultSheet />
                  {/* Last, so the banner floats above the result sheet as well as the tabs. */}
                  <ErrorToast />
                </ScanResultProvider>
              </RegionProvider>
            </ToastProvider>
          </ScanSettingsProvider>
        </SQLiteProvider>
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}
