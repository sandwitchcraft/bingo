/**
 * Root route. Everything the app renders is inside this tree.
 *
 * Its whole job is composition: load the brand fonts, hold the theme preference, mount the
 * provider stack (SQLite → scan settings → toast → region → scan result), and declare the
 * top-level routes — the `(tabs)` group and the pushed `add-place` and `item` screens.
 * The two pieces
 * of always-on UI that must float above every screen, `ScanResultSheet` and `ErrorToast`,
 * are mounted here rather than per-screen.
 *
 * Provider nesting order is load-bearing and each rung is commented inline below; the
 * SQLiteProvider memo note in particular is the reason theme state lives above it.
 */
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from "@expo-google-fonts/hanken-grotesk";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DATABASE_NAME, DATABASE_OPTIONS, migrateDbAsync } from "@/features/history/db";
import { PlacesSheet } from "@/features/region/PlacesSheet";
import { PlacesProvider } from "@/features/region/placesStore";
import { RegionProvider } from "@/features/region/regionStore";
import { ReportProvider } from "@/features/reports/reportStore";
import { ReportSheet } from "@/features/reports/ReportSheet";
import { ScanResultSheet } from "@/features/scan/ScanResultSheet";
import { ScanResultProvider } from "@/features/scan/scanResult";
import { ScanSettingsProvider } from "@/features/scan/scanSettings";
import { ErrorToast } from "@/ui/ErrorToast";
import { resolveTheme, THEMES, ThemeContext, type ThemePreference } from "@/ui/theme";
import { ToastProvider } from "@/ui/toast";

export default function RootLayout() {
  // The three faces the design system allows, at the weights it uses — see brand.ts.
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    IBMPlexMono_400Regular,
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
                {/* Saved places sit on top of the region store: they drive selectRegion /
                    downloads on the user's behalf, so they need it above them. */}
                <PlacesProvider>
                  <ScanResultProvider>
                    {/* Holds the report sheet's open/close state; the sheet is rendered below,
                        above the result sheet but under the toast. */}
                    <ReportProvider>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(tabs)" />
                        {/* Not a tab — pushed from the Location tab, and the native stack's
                            slide-from-right is what gives it its reveal (and back-swipe). */}
                        <Stack.Screen name="add-place" options={{ animation: "slide_from_right" }} />
                        {/* The full-screen item result, pushed from the Search tab. Same
                            native slide (and back-swipe) as add-place. */}
                        <Stack.Screen name="item" options={{ animation: "slide_from_right" }} />
                      </Stack>
                      <ScanResultSheet />
                      {/* The places dropdown, raised from any screen's location chip. */}
                      <PlacesSheet />
                      {/* Above the result sheet and tabs; still under the toast below. */}
                      <ReportSheet />
                      {/* Last, so the banner floats above the report and result sheets as well
                          as the tabs. */}
                      <ErrorToast />
                    </ReportProvider>
                  </ScanResultProvider>
                </PlacesProvider>
              </RegionProvider>
            </ToastProvider>
          </ScanSettingsProvider>
        </SQLiteProvider>
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}
