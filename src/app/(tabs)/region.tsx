/**
 * Location tab — your places, and the home base for the one in use. Leftmost tab, so "what
 * am I sorting against, and what does it want me to know" is one tap away.
 *
 * Top to bottom: **your places** (the active one marked; tap to switch, swipe left to delete,
 * tap the chevron to edit; "Add a place" pushes `src/app/add-place.tsx`, the only screen that
 * shows the full region catalog), then for the active region its **notices** (newest first)
 * and the **plastic codes grid** — the seven resin numbers, each in this region's verdict
 * tint, with one selected at a time to show what it covers and the region's note on it.
 *
 * Notices and plastics come from `getRegionInfo(rules)` — bingoDB fields, hand-maintained on
 * the DB side for now (see `regionInfo.ts`). The screen holds no state beyond which code is
 * open and which place is mid-switch.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";

import { BIN_LABEL, BIN_SHORT_LABEL } from "@/core/bins";
import { usePlaces, type Place } from "@/features/region/placesStore";
import { getRegionName } from "@/features/region/regionData";
import {
  getRegionInfo,
  PLASTIC_CODES,
  plasticVerdict,
  RECYCLING_SYMBOL,
  sortedNotices,
  type PlasticCode,
  type RegionNotice,
} from "@/features/region/regionInfo";
import { regionSubtitle } from "@/features/region/regionSource";
import { useRegion } from "@/features/region/regionStore";
import { CheckGlyph, ChevronRightGlyph, ExternalGlyph, PlusGlyph } from "@/ui/Icons";
import { Lid } from "@/ui/Lid";
import { Wordmark } from "@/ui/Wordmark";
import { palette, radii, TYPE, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

/** "Sep 1" this year, "Sep 1, 2025" otherwise — the year only earns its space once it differs. */
function formatNoticeDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function NoticeCard({ notice, onOpenLink }: { notice: RegionNotice; onOpenLink: (url: string) => void }) {
  const { theme } = useTheme();
  const isAlert = notice.kind === "alert";

  return (
    <View
      style={[
        styles.card,
        // An action-needed notice takes the alert hairline; that's its only marker — no tag.
        { backgroundColor: theme.card, borderColor: isAlert ? palette.alert : theme.line },
      ]}
    >
      <Text style={[TYPE.mono, { color: theme.text2 }]}>{formatNoticeDate(notice.date)}</Text>
      <Text style={[TYPE.title, styles.noticeTitle, { color: theme.text }]}>{notice.title}</Text>
      <Text style={[TYPE.note, styles.noticeBody, { color: theme.text }]}>{notice.body}</Text>
      {notice.link && (
        <Pressable
          onPress={() => onOpenLink(notice.link!)}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.noticeLink}
        >
          <Text style={[TYPE.button, { color: theme.accentStrong }]}>Read more</Text>
          <ExternalGlyph size={14} color={theme.accentStrong} />
        </Pressable>
      )}
    </View>
  );
}

export default function LocationScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { rules, selectedId, catalog, siteUrls } = useRegion();
  const { places, activePlaceId, switchPlace, removePlace } = usePlaces();
  const { showError } = useToast();

  const regionName = getRegionName(rules);
  const siteUrl = siteUrls[selectedId] ?? rules.site_url;
  const [busyId, setBusyId] = useState<string | null>(null);

  /** "Halton · Ontario, Canada" for a place's row, from the catalog when it has the entry. */
  const regionLineOf = (place: Place) => {
    const entry = catalog.find((e) => e.id === place.regionId);
    if (!entry) return place.regionId === selectedId ? regionName : place.regionId;
    const parents = regionSubtitle(entry);
    return parents ? `${entry.displayName} · ${parents}` : entry.displayName;
  };

  const choosePlace = (place: Place) => {
    if (busyId || place.id === activePlaceId) return;
    setBusyId(place.id);
    switchPlace(place.id)
      .catch((error: unknown) => {
        console.warn("[places] failed to switch place", error);
        showError(`Couldn't switch to ${place.label}. Its saved rules may be unavailable.`);
      })
      .finally(() => setBusyId(null));
  };

  const deletePlace = (place: Place, swipeable: SwipeableMethods) => {
    swipeable.close();
    removePlace(place.id).catch((error: unknown) => {
      console.warn("[places] failed to remove place", error);
      showError(`Couldn't remove ${place.label}.`);
    });
  };

  const info = getRegionInfo(rules);
  const notices = sortedNotices(info);

  const [openCode, setOpenCode] = useState<PlasticCode>(1);
  const openEntry = PLASTIC_CODES.find((entry) => entry.code === openCode) ?? PLASTIC_CODES[0];
  const openVerdict = plasticVerdict(info, openEntry.code);
  const openSwatch = theme.bins[openVerdict.bin];

  const openLink = (url: string) => {
    Linking.openURL(url).catch((error: unknown) => {
      console.warn("[region] failed to open link", error);
      showError("Couldn't open that link.");
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Wordmark />
          <Text style={[TYPE.h2, { color: theme.text }]}>Your location</Text>
          <Text style={[TYPE.bodySm, { color: theme.text2 }]}>
            Every region sorts differently. Keep the places you live between and switch in a tap.
          </Text>
        </View>

        {/* Your places. The active one is tinted; tap another to switch; swipe to delete (not
            the last one — there's always somewhere to sort against). */}
        <View style={styles.stack}>
          {(places ?? []).map((place) => {
            const active = place.id === activePlaceId;
            const row = (
              <Pressable
                style={({ pressed }) => [
                  styles.placeRow,
                  {
                    backgroundColor: active ? theme.accentTint : pressed ? theme.surface : theme.card,
                    borderColor: active ? theme.accent : theme.line,
                  },
                ]}
                onPress={() => choosePlace(place)}
                disabled={busyId != null}
                accessibilityRole="button"
                accessibilityState={{ selected: active, busy: busyId === place.id }}
                accessibilityLabel={`${place.label}, ${regionLineOf(place)}${active ? ", in use" : ""}`}
              >
                <View style={styles.placeText}>
                  <Text style={[TYPE.title, { color: theme.text }]} numberOfLines={1}>
                    {place.label}
                  </Text>
                  <Text style={[TYPE.micro, { color: theme.text2 }]} numberOfLines={1}>
                    {regionLineOf(place)}
                  </Text>
                </View>
                {active && <CheckGlyph size={21} color={theme.accentStrong} />}
                <Pressable
                  onPress={() => router.push({ pathname: "/add-place", params: { placeId: place.id } })}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${place.label}`}
                >
                  <ChevronRightGlyph size={20} color={theme.text2} />
                </Pressable>
              </Pressable>
            );
            if ((places ?? []).length <= 1) return <View key={place.id}>{row}</View>;
            return (
              <ReanimatedSwipeable
                key={place.id}
                containerStyle={styles.swipeContainer}
                friction={2}
                rightThreshold={40}
                overshootRight={false}
                renderRightActions={(_progress, _translation, swipeable) => (
                  <Pressable
                    style={styles.removeAction}
                    onPress={() => deletePlace(place, swipeable)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${place.label}`}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                )}
              >
                {row}
              </ReanimatedSwipeable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push("/add-place")}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.addPlace,
            { borderColor: theme.lineStrong, backgroundColor: pressed ? theme.accentTint : "transparent" },
          ]}
        >
          <PlusGlyph size={20} color={theme.accentStrong} />
          <Text style={[TYPE.title, { fontSize: 16, color: theme.accentStrong }]}>Add a place</Text>
        </Pressable>
        <Text style={[TYPE.micro, styles.sectionLabel, { color: theme.text2 }]}>
          Notices from {regionName}
        </Text>
        {notices.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[TYPE.note, { color: theme.text2 }]}>
              {regionName} hasn&apos;t published any notices yet.
            </Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {notices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} onOpenLink={openLink} />
            ))}
          </View>
        )}

        <Text style={[TYPE.micro, styles.sectionLabel, { color: theme.text2 }]}>
          {RECYCLING_SYMBOL} Plastic codes
        </Text>
        <Text style={[TYPE.small, styles.hint, { color: theme.text2 }]}>
          The number inside the triangle on a plastic item. Tap one to see what {regionName} does
          with it.
        </Text>
        <View style={styles.codeRow} accessibilityRole="tablist">
          {PLASTIC_CODES.map((entry) => {
            const verdict = plasticVerdict(info, entry.code);
            const swatch = theme.bins[verdict.bin];
            const isOpen = entry.code === openCode;
            return (
              <Pressable
                key={entry.code}
                onPress={() => setOpenCode(entry.code)}
                style={[
                  styles.codeBadge,
                  { backgroundColor: swatch.tint, borderColor: isOpen ? swatch.fill : "transparent" },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isOpen }}
                accessibilityLabel={`Plastic ${entry.code}, ${entry.abbreviation}: ${BIN_LABEL[verdict.bin]}`}
              >
                <Text style={[styles.codeSymbol, { color: swatch.tintInk }]}>{entry.symbol}</Text>
                <Text style={[TYPE.mono, styles.codeAbbr, { color: swatch.tintInk }]} numberOfLines={1}>
                  {entry.abbreviation}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: openSwatch.tint }]}>
          <View style={styles.detailTop}>
            <Text style={[TYPE.title, { color: openSwatch.tintInk }]}>
              {openEntry.symbol} {openEntry.abbreviation}
            </Text>
            <View style={styles.verdict}>
              <Lid bin={openVerdict.bin} width={8} height={18} />
              <Text style={[TYPE.rowBin, { color: openSwatch.tintInk }]}>
                {BIN_SHORT_LABEL[openVerdict.bin]}
              </Text>
            </View>
          </View>
          <Text style={[TYPE.small, { color: openSwatch.tintInk, opacity: 0.85 }]}>{openEntry.name}</Text>
          {openVerdict.note && (
            <Text style={[TYPE.note, styles.detailNote, { color: openSwatch.tintInk }]}>
              {openVerdict.note}
            </Text>
          )}
          <Text style={[TYPE.small, styles.detailExamples, { color: openSwatch.tintInk, opacity: 0.85 }]}>
            Common items: {openEntry.examples}
          </Text>
        </View>

        {/* Legend: the same three lids the grid uses, named once. */}
        <View style={styles.legend}>
          {(["recycling", "garbage", "consult-local-guide"] as const).map((bin) => (
            <View key={bin} style={styles.legendItem}>
              <Lid bin={bin} width={6} height={14} />
              <Text style={[TYPE.small, { color: theme.text2 }]}>
                {bin === "consult-local-guide" ? "Depends" : BIN_LABEL[bin]}
              </Text>
            </View>
          ))}
        </View>

        {siteUrl !== "" && (
          <Pressable
            onPress={() => openLink(siteUrl)}
            style={({ pressed }) => [
              styles.guideRow,
              { borderColor: theme.line, backgroundColor: pressed ? theme.surface : "transparent" },
            ]}
            accessibilityRole="link"
            accessibilityLabel={`Open the ${regionName} waste guide`}
          >
            <Text style={[TYPE.note, styles.guideText, { color: theme.text }]} numberOfLines={1}>
              {rules.provider_name}
            </Text>
            <ExternalGlyph size={18} color={theme.text2} />
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: 22, paddingBottom: 40 },
  header: { paddingTop: 10, paddingBottom: 20, gap: 10 },

  sectionLabel: { marginTop: 26, marginBottom: 10 },
  hint: { marginBottom: 12 },
  stack: { gap: 9 },

  card: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radii.md,
    padding: 16,
  },

  // The sheet's PlaceRow: 24 radius, hairline; the active row takes accent tint + border.
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 17,
    paddingVertical: 15,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  placeText: { flex: 1, gap: 2 },
  swipeContainer: { borderRadius: radii.lg, overflow: "hidden" },
  // Its own pill, set off from the row by a gap, so the row's rounded corner never meets a
  // flat edge — the two read as separate cards sliding past each other.
  removeAction: {
    backgroundColor: palette.alert,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
    marginLeft: 9,
    borderRadius: radii.lg,
  },
  removeText: { ...TYPE.button, fontSize: 14, color: palette.cream50 },
  addPlace: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 17,
    paddingVertical: 15,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
  },


  noticeTitle: { marginTop: 8 },
  noticeBody: { marginTop: 6 },
  noticeLink: { marginTop: 12, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 },

  codeRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  codeBadge: {
    flex: 1,
    aspectRatio: 0.9,
    borderWidth: 2,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  // The resin glyph comes from the system symbol font (Bricolage has no U+2673 range), so it
  // gets a plain size rather than a TYPE preset.
  codeSymbol: { fontSize: 24, lineHeight: 28 },
  codeAbbr: { fontSize: 8, letterSpacing: 0.4 },

  detailTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  verdict: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailNote: { marginTop: 10 },
  detailExamples: { marginTop: 8 },

  legend: { flexDirection: "row", gap: 16, marginTop: 10, paddingHorizontal: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },

  guideRow: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  guideText: { flex: 1 },
});
