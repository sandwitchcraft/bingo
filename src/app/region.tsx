import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CheckIcon,
  CloudDownloadIcon,
  ExternalLinkIcon,
  StopCircleIcon,
} from "@/features/region/RegionIcons";
import { BUNDLED_REGION_ID, regionSubtitle, type RegionSummary } from "@/features/region/regionSource";
import { useRegion } from "@/features/region/regionStore";
import { accent, colors, FONT, radii, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

/**
 * Full-screen region picker, pushed from Settings. The slide-in reveal is the native
 * stack's `slide_from_right` (configured in `_layout.tsx`) rather than a hand-rolled
 * transform, so the interactive back-swipe comes with it.
 *
 * Two actions per row, which is the thing to keep straight when reading this: the **row body
 * downloads-then-selects** (whatever it takes to start sorting against this region — a fetch
 * if the rules aren't on disk yet, then the switch), and the **cloud icon downloads only**
 * (stores the rules; changes nothing about what you're sorting against right now — the
 * saving-ahead-of-a-trip case). Once a region is downloaded, `selectRegion` reads it from the
 * cache, so switching back to it later works with no network at all.
 */

/**
 * How long a download must run before its spinner appears. A region file is ~4 KB, so on any
 * healthy connection the whole thing is over in a couple of hundred milliseconds — a spinner
 * for that reads as a flicker, and a cancel button nobody could hit is a lie. Past this
 * threshold the transfer is genuinely slow, and both become worth showing.
 */
const SPINNER_DELAY_MS = 1000;

type DownloadState = { showSpinner: boolean };

/**
 * Row spacing, as a separator rather than a margin on the row itself: a swipeable row's
 * margin sits *inside* the clipped container, which would leave the red action panel
 * shorter than the card it belongs to.
 */
function RowGap() {
  return <View style={styles.rowGap} />;
}

export default function RegionScreen() {
  const { theme, name } = useTheme();
  const router = useRouter();
  const {
    catalog,
    catalogIsFallback,
    selectedId,
    downloadedIds,
    siteUrls,
    downloadRegion,
    removeDownload,
    selectRegion,
  } = useRegion();
  const { showError } = useToast();

  const [query, setQuery] = useState("");
  // Keyed by region id so several can download at once — saving a few before a trip is the
  // case this whole feature exists for.
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);

  // Kept out of state: aborting and clearing timers are imperative, and re-rendering on
  // every controller change would buy nothing.
  const controllers = useRef(new Map<string, AbortController>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Leaving the screen mid-download shouldn't leave a request and a timer running against a
  // component that no longer exists.
  useEffect(() => {
    const inFlight = controllers.current;
    const pending = timers.current;
    return () => {
      inFlight.forEach((controller) => controller.abort());
      pending.forEach((timer) => clearTimeout(timer));
      inFlight.clear();
      pending.clear();
    };
  }, []);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // Parents and slugs are in the haystack too, so "ontario" or "canada" finds every
    // region under them even though neither is a region you can select.
    const matches = (region: RegionSummary) =>
      needle === "" ||
      [region.displayName, ...region.parents, ...region.path]
        .join(" ")
        .toLowerCase()
        .includes(needle);

    const found = catalog.filter(matches);
    return [
      { key: "downloaded", title: "Downloaded", data: found.filter((r) => downloadedIds.has(r.id)) },
      { key: "available", title: "Available", data: found.filter((r) => !downloadedIds.has(r.id)) },
      // A section with no rows would render as a header floating over nothing.
    ].filter((section) => section.data.length > 0);
  }, [catalog, downloadedIds, query]);

  const endDownload = (regionId: string) => {
    const timer = timers.current.get(regionId);
    if (timer) clearTimeout(timer);
    timers.current.delete(regionId);
    controllers.current.delete(regionId);
    setDownloads((current) => {
      const next = { ...current };
      delete next[regionId];
      return next;
    });
  };

  const startDownload = (region: RegionSummary) => {
    if (downloads[region.id]) return;

    const controller = new AbortController();
    controllers.current.set(region.id, controller);
    setDownloads((current) => ({ ...current, [region.id]: { showSpinner: false } }));

    // The row shows nothing at all until this fires — see SPINNER_DELAY_MS.
    timers.current.set(
      region.id,
      setTimeout(() => {
        setDownloads((current) =>
          current[region.id] ? { ...current, [region.id]: { showSpinner: true } } : current,
        );
      }, SPINNER_DELAY_MS),
    );

    downloadRegion(region, controller.signal)
      .then(() => endDownload(region.id))
      .catch((error: unknown) => {
        endDownload(region.id);
        // A cancel is a user decision, not a failure to report back to them.
        if (controller.signal.aborted) return;
        console.warn("[region] download failed", error);
        showError(`Couldn't download ${region.displayName}. Check your connection and try again.`);
      });
  };

  const choose = (region: RegionSummary) => {
    if (pendingSelectId) return;
    if (region.id === selectedId) {
      router.back();
      return;
    }
    setPendingSelectId(region.id);
    // Tapping a not-yet-downloaded row downloads its rules first, then selects — one gesture
    // for the common case. The cloud icon still downloads *without* switching, which is the
    // saving-ahead-of-a-trip case. A row already downloading via that icon just gets its rules
    // fetched again here (a ~4 KB no-op); we don't try to adopt the in-flight request.
    const isDownloaded = downloadedIds.has(region.id);
    const ready = isDownloaded ? Promise.resolve() : downloadRegion(region);
    ready
      .then(() => selectRegion(region))
      .then(() => router.back())
      .catch((error: unknown) => {
        // A fresh download can fail on the network; selecting a downloaded region reads off
        // disk and shouldn't. Either way the previous region stays selected — selectRegion
        // only commits once it has rules in hand.
        console.warn("[region] failed to switch region", error);
        showError(
          isDownloaded
            ? `Couldn't switch to ${region.displayName}. Its saved rules may be damaged.`
            : `Couldn't download ${region.displayName}. Check your connection and try again.`,
        );
        setPendingSelectId(null);
      });
  };

  // Leaves the app for the municipality's own waste page — the authority the rules were
  // transcribed from, and the place to check when a listing looks wrong.
  const openSite = (region: RegionSummary, url: string) => {
    Linking.openURL(url).catch((error: unknown) => {
      console.warn("[region] failed to open site url", error);
      showError(`Couldn't open the ${region.displayName} waste guide.`);
    });
  };

  const remove = (region: RegionSummary, swipeable: SwipeableMethods) => {
    swipeable.close();
    removeDownload(region.id).catch((error: unknown) => {
      console.warn("[region] failed to remove download", error);
      showError(`Couldn't remove ${region.displayName}.`);
    });
  };

  const renderRow = ({ item }: { item: RegionSummary }) => {
    const isSelected = item.id === selectedId;
    const isBundled = item.id === BUNDLED_REGION_ID;
    const isDownloaded = downloadedIds.has(item.id);
    const download = downloads[item.id];
    const isSelecting = item.id === pendingSelectId;
    const subtitle = regionSubtitle(item);
    // Only downloaded regions have one: site_url arrives with the rules, not the index.
    const siteUrl = siteUrls[item.id];

    const row = (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: theme.card, borderColor: isSelected ? accent[name] : theme.cardBorder },
          pressed && { backgroundColor: theme.bgInput },
        ]}
        onPress={() => choose(item)}
        disabled={isSelecting}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, busy: isSelecting }}
        accessibilityHint={
          isDownloaded ? undefined : "Downloads this region and switches to it"
        }
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: theme.text }]}>{item.displayName}</Text>
          <Text style={[styles.rowSub, { color: theme.textMuted }]} numberOfLines={1}>
            {/* ACTIVE carries the selection now that the check means "downloaded". */}
            {isSelected && <Text style={{ color: accent[name] }}>ACTIVE · </Text>}
            {isBundled && "BUILT IN · "}
            {subtitle}
          </Text>
        </View>

        <View style={styles.rowActions}>
          {siteUrl ? (
            <Pressable
              onPress={() => openSite(item, siteUrl)}
              hitSlop={12}
              accessibilityRole="link"
              accessibilityLabel={`Open the ${item.displayName} waste guide in your browser`}
            >
              <ExternalLinkIcon size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}

          {isSelecting ? (
            <ActivityIndicator size="small" color={accent[name]} />
          ) : download ? (
            // Nothing is rendered until the download crosses SPINNER_DELAY_MS.
            download.showSpinner && (
              <Pressable
                onPress={() => controllers.current.get(item.id)?.abort()}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Stop downloading ${item.displayName}`}
              >
                <StopCircleIcon size={22} color={accent[name]} />
              </Pressable>
            )
          ) : isDownloaded ? (
            <CheckIcon size={22} color={isSelected ? accent[name] : theme.textMuted} />
          ) : (
            <Pressable
              onPress={() => startDownload(item)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Download ${item.displayName}`}
            >
              <CloudDownloadIcon size={22} color={accent[name]} />
            </Pressable>
          )}
        </View>
      </Pressable>
    );

    // The active region and the bundled one aren't swipeable: one is the rules in use, the
    // other ships inside the binary and has nothing on disk to reclaim.
    if (!isDownloaded || isSelected || isBundled) return row;

    return (
      <ReanimatedSwipeable
        containerStyle={styles.swipeContainer}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={(_progress, _translation, swipeable) => (
          <Pressable
            style={styles.removeAction}
            onPress={() => remove(item, swipeable)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.displayName} download`}
          >
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        )}
      >
        {row}
      </ReanimatedSwipeable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: theme.textMuted }]}>‹ Settings</Text>
        </Pressable>
        <Text style={[styles.heading, { color: theme.text }]}>Region</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.search, { backgroundColor: theme.bgInput, color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search regions"
          placeholderTextColor={theme.textSubtle}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>{section.title}</Text>
        )}
        ItemSeparatorComponent={RowGap}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            No regions match “{query.trim()}”.
          </Text>
        }
        ListFooterComponent={
          // The catalog only lists regions bingoDB actually publishes, so a short list
          // is normal — but a short list *because we're offline* needs saying, or it
          // reads as the database being nearly empty.
          catalogIsFallback ? (
            <Text style={[styles.footer, { color: theme.textMuted }]}>
              Showing the regions included with the app — the full list couldn’t be
              downloaded. Reconnect and reopen this screen to see everything available.
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  back: { fontFamily: FONT.utility, fontSize: 12, letterSpacing: 0.4 },
  heading: { fontFamily: FONT.heading, fontSize: 26, letterSpacing: -0.4, marginTop: 6 },
  searchWrap: { paddingHorizontal: 24, paddingBottom: 12 },
  search: {
    fontFamily: FONT.body,
    fontSize: 15,
    borderRadius: radii.button,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  list: { paddingHorizontal: 24, paddingBottom: 32 },
  // Same eyebrow treatment as the Settings section labels.
  sectionHeader: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    paddingTop: 18,
    paddingBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  // The link sits left of the download-state slot, which stays rightmost so the column of
  // cloud/check glyphs still reads straight down the list.
  rowActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  rowGap: { height: 10 },
  rowText: { flexShrink: 1 },
  rowName: { fontFamily: FONT.heading, fontSize: 16 },
  rowSub: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 4,
  },
  // Clips the red action to the row's own corners so it can't square off the card edge.
  swipeContainer: { borderRadius: radii.card, overflow: "hidden" },
  removeAction: {
    backgroundColor: colors.alert,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  removeText: {
    fontFamily: FONT.utilityStrong,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.white,
  },
  empty: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19, paddingTop: 8 },
  footer: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18, marginTop: 18 },
});
