/**
 * Saved places — "Home", "Work", "Cottage" — each pinned to exactly one region's rules.
 *
 * This is the layer the user actually switches between. The region catalog is large and
 * impersonal; a place is the two or three entries out of it that matter to *this* person,
 * under the names they'd use. `RegionProvider` below stays the owner of rules, downloads and
 * the selected region; this provider owns the labels and drives that store on the user's
 * behalf:
 *
 * - **Saving a place downloads its rules** (if they aren't on disk) and switches to it.
 * - **Switching a place** is `selectRegion` on its region — cache-only, so it works offline.
 * - **Deleting a place removes its download** when no other place uses that region, so the
 *   rules on disk are exactly the rules some place needs (the bundled region excepted — it
 *   ships in the binary). If the deleted place was active, the first remaining place takes
 *   over. The last place can't be deleted.
 * - **First launch seeds one place**, "Home", from whatever region was selected — bundled
 *   Toronto on a fresh install, or the region an existing install had picked — so there is
 *   never an empty state to get past.
 *
 * `activePlaceId` is persisted separately from `selectedRegionId` because two places may
 * share a region ("Home" and "Mum's" both in Halton). When the selected region changes by a
 * route other than a place (location detect inside "add a place"), the active place is
 * re-derived: the first place on that region, or none.
 *
 * The places sheet (the dropdown under the location chip) keeps its open/closed state here
 * too, so any screen's chip can raise the one sheet mounted at the root.
 */
import * as Crypto from "expo-crypto";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getJSON, getString, setJSON, setString, StorageKeys } from "@/core/storage";
import { BUNDLED_REGION_ID, type RegionSummary } from "@/features/region/regionSource";
import { useRegion } from "@/features/region/regionStore";

export type Place = {
  id: string;
  label: string;
  regionId: string;
};

/** The default seed label, and the first suggestion offered when adding a place. */
export const DEFAULT_PLACE_LABEL = "Home";

/** Suggested labels on the add-place screen. Roles, not addresses. */
export const PLACE_LABEL_SUGGESTIONS = ["Home", "Work", "Cottage", "School", "Parents'"] as const;

type PlacesValue = {
  /** `null` until storage has been read, so a list can't flash empty before the seed lands. */
  places: Place[] | null;
  activePlaceId: string | null;
  /** The place in use, if the selected region belongs to one. */
  activePlace: Place | null;
  /** Save a new place: downloads the region if needed, switches to it, makes it active. */
  addPlace: (label: string, region: RegionSummary) => Promise<Place>;
  /** Rename and/or re-point a place. A region change on the active place switches rules. */
  updatePlace: (placeId: string, label: string, region: RegionSummary) => Promise<void>;
  /** Switch the rules in use to this place's region. */
  switchPlace: (placeId: string) => Promise<void>;
  /** Rejects for the last remaining place. */
  removePlace: (placeId: string) => Promise<void>;
  /** The places dropdown (a bottom sheet mounted at the root). */
  sheetOpen: boolean;
  /**
   * When the sheet was opened from a result, the item being looked at — the sheet then shows
   * which bin that item lands in at each place, so switching is an informed choice.
   */
  sheetItemKey: string | null;
  openSheet: (itemKey?: string) => void;
  closeSheet: () => void;
};

const PlacesContext = createContext<PlacesValue | null>(null);

function isPlace(value: unknown): value is Place {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === "string" && typeof p.label === "string" && typeof p.regionId === "string";
}

function log(message: string) {
  if (__DEV__) console.log(`[places] ${message}`);
}

export function PlacesProvider({ children }: { children: ReactNode }) {
  const { catalog, selectedId, downloadedIds, downloadRegion, removeDownload, selectRegion } = useRegion();

  const [places, setPlaces] = useState<Place[] | null>(null);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItemKey, setSheetItemKey] = useState<string | null>(null);

  // Mirrors for the callbacks below, which must read the latest list without closing over it.
  const placesRef = useRef<Place[]>([]);
  const activeRef = useRef<string | null>(null);

  const commit = useCallback((next: Place[]) => {
    placesRef.current = next;
    setPlaces(next);
    setJSON(StorageKeys.places, next).catch((error: unknown) => {
      console.warn("[places] failed to persist places", error);
    });
  }, []);

  const commitActive = useCallback((id: string | null) => {
    activeRef.current = id;
    setActivePlaceId(id);
    setString(StorageKeys.activePlaceId, id ?? "").catch((error: unknown) => {
      console.warn("[places] failed to persist active place", error);
    });
  }, []);

  // Restore, or seed. The seed reads the persisted region id straight from storage rather
  // than from `selectedId`, which RegionProvider restores asynchronously — the two reads race
  // otherwise, and a fresh install would seed "Home" as the bundled region while an existing
  // install's real selection was still loading.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const stored = await getJSON<unknown>(StorageKeys.places);
      if (cancelled) return;
      let list = Array.isArray(stored) ? stored.filter(isPlace) : [];
      if (list.length === 0) {
        const regionId = (await getString(StorageKeys.selectedRegionId)) ?? BUNDLED_REGION_ID;
        if (cancelled) return;
        list = [{ id: Crypto.randomUUID(), label: DEFAULT_PLACE_LABEL, regionId }];
        log(`seeded "${DEFAULT_PLACE_LABEL}" from ${regionId}`);
        commit(list);
      } else {
        placesRef.current = list;
        setPlaces(list);
      }
      const storedActive = await getString(StorageKeys.activePlaceId);
      if (cancelled) return;
      const selected = (await getString(StorageKeys.selectedRegionId)) ?? BUNDLED_REGION_ID;
      if (cancelled) return;
      const byId = list.find((p) => p.id === storedActive && p.regionId === selected);
      const byRegion = list.find((p) => p.regionId === selected);
      const active = (byId ?? byRegion)?.id ?? null;
      activeRef.current = active;
      setActivePlaceId(active);
    };
    load().catch((error: unknown) => console.warn("[places] failed to restore places", error));
    return () => {
      cancelled = true;
    };
  }, [commit]);

  // Keep the active place honest whenever the region changes from outside this store
  // (location detect in add-place, or a store repair). If the active place no longer matches
  // the selected region, hand over to a place that does — or to none.
  useEffect(() => {
    if (places === null) return;
    const current = places.find((p) => p.id === activeRef.current);
    if (current && current.regionId === selectedId) return;
    const next = places.find((p) => p.regionId === selectedId)?.id ?? null;
    if (next !== activeRef.current) commitActive(next);
  }, [places, selectedId, commitActive]);

  /** A RegionSummary for `regionId`, from the catalog or — offline, off-catalog — a stand-in. */
  const summaryFor = useCallback(
    (regionId: string, label: string): RegionSummary =>
      catalog.find((entry) => entry.id === regionId) ?? {
        id: regionId,
        displayName: label,
        level: "",
        path: regionId.split("@")[0].split("/"),
        parents: [],
        providerType: regionId.includes("@") ? "commercial" : "municipal",
        // No URL: `selectRegion` reads the cache first and only fetches as a repair, so a
        // downloaded region still switches. A missing cache surfaces as its error.
        url: "",
      },
    [catalog],
  );

  const ensureDownloaded = useCallback(
    async (region: RegionSummary) => {
      if (downloadedIds.has(region.id)) return;
      await downloadRegion(region);
    },
    [downloadedIds, downloadRegion],
  );

  /** Drop a region's download if no place still points at it. Never the bundled region. */
  const pruneRegion = useCallback(
    async (regionId: string, remaining: Place[]) => {
      if (regionId === BUNDLED_REGION_ID) return;
      if (remaining.some((p) => p.regionId === regionId)) return;
      try {
        await removeDownload(regionId);
      } catch (error) {
        // The store refuses to remove the region in use; that's fine — it means the region is
        // still selected, and the next switch away will leave it orphaned but harmless.
        console.warn(`[places] kept download for ${regionId}`, error);
      }
    },
    [removeDownload],
  );

  const addPlace = useCallback(
    async (label: string, region: RegionSummary) => {
      await ensureDownloaded(region);
      await selectRegion(region);
      const place: Place = { id: Crypto.randomUUID(), label: label.trim(), regionId: region.id };
      commit([...placesRef.current, place]);
      commitActive(place.id);
      log(`added "${place.label}" → ${region.id}`);
      return place;
    },
    [ensureDownloaded, selectRegion, commit, commitActive],
  );

  const updatePlace = useCallback(
    async (placeId: string, label: string, region: RegionSummary) => {
      const current = placesRef.current.find((p) => p.id === placeId);
      if (!current) throw new Error("That place no longer exists");
      const regionChanged = current.regionId !== region.id;
      if (regionChanged) {
        await ensureDownloaded(region);
        if (activeRef.current === placeId) await selectRegion(region);
      }
      const next = placesRef.current.map((p) =>
        p.id === placeId ? { ...p, label: label.trim(), regionId: region.id } : p,
      );
      commit(next);
      if (regionChanged) await pruneRegion(current.regionId, next);
      log(`updated "${label}" → ${region.id}`);
    },
    [ensureDownloaded, selectRegion, commit, pruneRegion],
  );

  const switchPlace = useCallback(
    async (placeId: string) => {
      const place = placesRef.current.find((p) => p.id === placeId);
      if (!place) throw new Error("That place no longer exists");
      if (place.regionId !== selectedId) await selectRegion(summaryFor(place.regionId, place.label));
      commitActive(place.id);
      log(`switched to "${place.label}"`);
    },
    [selectedId, selectRegion, summaryFor, commitActive],
  );

  const removePlace = useCallback(
    async (placeId: string) => {
      const list = placesRef.current;
      const place = list.find((p) => p.id === placeId);
      if (!place) return;
      if (list.length <= 1) throw new Error("Keep at least one place");
      const remaining = list.filter((p) => p.id !== placeId);
      // Switch away first: the store won't remove the download of the region in use.
      if (activeRef.current === placeId) {
        const next = remaining[0];
        if (next.regionId !== place.regionId) await selectRegion(summaryFor(next.regionId, next.label));
        commitActive(next.id);
      }
      commit(remaining);
      await pruneRegion(place.regionId, remaining);
      log(`removed "${place.label}"`);
    },
    [selectRegion, summaryFor, commitActive, commit, pruneRegion],
  );

  const openSheet = useCallback((itemKey?: string) => {
    setSheetItemKey(itemKey ?? null);
    setSheetOpen(true);
  }, []);
  // The item is kept through the close animation (the rows would otherwise lose their lids
  // mid-slide); the next open replaces it.
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const activePlace = useMemo(
    () => places?.find((p) => p.id === activePlaceId) ?? null,
    [places, activePlaceId],
  );

  const value = useMemo<PlacesValue>(
    () => ({
      places,
      activePlaceId,
      activePlace,
      addPlace,
      updatePlace,
      switchPlace,
      removePlace,
      sheetOpen,
      sheetItemKey,
      openSheet,
      closeSheet,
    }),
    [
      places,
      activePlaceId,
      activePlace,
      addPlace,
      updatePlace,
      switchPlace,
      removePlace,
      sheetOpen,
      sheetItemKey,
      openSheet,
      closeSheet,
    ],
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces(): PlacesValue {
  const ctx = useContext(PlacesContext);
  if (!ctx) {
    throw new Error("usePlaces must be used within a PlacesProvider");
  }
  return ctx;
}
