import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  BASE_URL,
  BUNDLED_CATALOG,
  BUNDLED_RULES,
  BUNDLED_REGION_ID,
  deleteCachedRules,
  fetchRegionIndex,
  fetchRegionRules,
  listDownloadedRegionIds,
  readCachedIndex,
  readCachedRules,
  readCachedSiteUrls,
  writeCachedIndex,
  writeCachedRules,
  type RegionRules,
  type RegionSummary,
} from "@/lib/regionSource";
import { getString, setString, StorageKeys } from "@/lib/storage";

/**
 * The selected region and its rules.
 *
 * Cache-first by design: the bundled snapshot renders immediately, storage replaces it as
 * soon as it reads back, and the network refresh lands last. A failed refresh is logged and
 * dropped — the app stays usable on whatever rules it already had, which is the whole point
 * of shipping a bundled region.
 */
export type RefreshReport = {
  refreshed: number;
  /** Display names of regions whose refresh failed; the rest still landed. */
  failed: string[];
  /** The active region's rules after the pass, for reporting a version. */
  active: RegionRules;
};

type RegionValue = {
  rules: RegionRules;
  selectedId: string;
  catalog: RegionSummary[];
  /** True while the catalog is the bundled seed rather than a fetched/cached index. */
  catalogIsFallback: boolean;
  /**
   * Regions whose rules are on disk and therefore usable offline. Always contains
   * `BUNDLED_REGION_ID` — that one ships inside the binary, so it is downloaded by
   * definition and can never be removed.
   */
  downloadedIds: ReadonlySet<string>;
  /**
   * Region id → the provider's own waste page (`site_url` in the rules). Only downloaded
   * regions can appear, since that URL arrives with the rules; a region that publishes none
   * is absent rather than empty-stringed.
   */
  siteUrls: Readonly<Record<string, string>>;
  /**
   * Fetch and store one region's rules WITHOUT selecting it — that separation is the
   * feature: saving a region ahead of a trip shouldn't change the rules you're sorting
   * against right now. Pass a signal to make it cancellable.
   */
  downloadRegion: (summary: RegionSummary, signal?: AbortSignal) => Promise<void>;
  /** Rejects for the active region and the bundled one; both must stay usable. */
  removeDownload: (regionId: string) => Promise<void>;
  /**
   * Switch to an already-downloaded region. Reads the cached copy, so it works offline —
   * that's the payoff for gating selection on a download.
   */
  selectRegion: (summary: RegionSummary) => Promise<void>;
  /**
   * Re-fetch every downloaded region's rules, bypassing both caches. A region saved for a
   * trip should be current when you reach for it, not whenever you last happened to select
   * it. Rejects only if the active region itself can't be refreshed.
   */
  refreshDownloadedRules: () => Promise<RefreshReport>;
};

const RegionContext = createContext<RegionValue | null>(null);

/**
 * Where the rules in use actually came from. Failures already warn on their own; this is
 * the matching success trace, without which "no warning" is the only evidence the network
 * path ran — and that's indistinguishable from a cache hit. Dev-only, so it costs nothing
 * in release.
 */
function log(message: string) {
  if (__DEV__) console.log(`[region] ${message}`);
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<RegionRules>(BUNDLED_RULES);
  const [selectedId, setSelectedId] = useState<string>(BUNDLED_REGION_ID);
  const [catalog, setCatalog] = useState<RegionSummary[]>(BUNDLED_CATALOG);
  const [catalogIsFallback, setCatalogIsFallback] = useState(true);
  // Seeded with the bundled region rather than starting empty: it's downloaded by virtue of
  // being compiled in, and starting empty would briefly render it as needing a download.
  const [downloadedIds, setDownloadedIds] = useState<ReadonlySet<string>>(
    () => new Set([BUNDLED_REGION_ID]),
  );
  // Seeded from the bundled rules for the same reason as `downloadedIds` above.
  const [siteUrls, setSiteUrls] = useState<Readonly<Record<string, string>>>(() => {
    const seed: Record<string, string> = {};
    if (BUNDLED_RULES.site_url) seed[BUNDLED_REGION_ID] = BUNDLED_RULES.site_url;
    return seed;
  });

  // A slow index fetch must not overwrite a region the user picked while it was in flight.
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Read by refreshDownloadedRules, which stays a stable callback rather than being rebuilt
  // every time the catalog or the download set changes identity.
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  const downloadedIdsRef = useRef(downloadedIds);
  downloadedIdsRef.current = downloadedIds;

  /**
   * Keeps the link map in step with a set of rules we just wrote to disk. Removes the entry
   * when a region stops publishing a `site_url`, so the picker never offers a dead link.
   */
  const rememberSiteUrl = useCallback((regionId: string, next: RegionRules) => {
    setSiteUrls((current) => {
      if ((current[regionId] ?? "") === next.site_url) return current;
      const updated = { ...current };
      if (next.site_url) updated[regionId] = next.site_url;
      else delete updated[regionId];
      return updated;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const savedId = (await getString(StorageKeys.selectedRegionId)) ?? BUNDLED_REGION_ID;
      if (cancelled) return;

      // The persisted id IS the selection, so it's applied whether or not rules for it turn
      // up below — otherwise the picker's checkmark could disagree with the rules in use.
      setSelectedId(savedId);
      selectedIdRef.current = savedId;

      // Cached rules next, so the chosen region is live before any network call. Read even
      // for the bundled region: a previously fetched copy of it is newer than the snapshot.
      const cachedRules = await readCachedRules(savedId);
      if (cancelled) return;
      if (cachedRules) setRules(cachedRules);

      // Which regions are on disk. Unioned with the bundled id, never replaced by the scan:
      // Toronto has no cache entry until it's been refreshed once, but it's always usable.
      const storedIds = await listDownloadedRegionIds();
      if (cancelled) return;
      const downloaded = new Set([BUNDLED_REGION_ID, ...storedIds]);
      setDownloadedIds(downloaded);

      const links = await readCachedSiteUrls(downloaded);
      if (cancelled) return;
      setSiteUrls(links);

      const cachedIndex = await readCachedIndex();
      if (cancelled) return;
      // Seeded with the bundled catalog so the rules refresh below still has a URL to
      // fetch for the seeded regions if the host's index.json is unreachable.
      let available = cachedIndex ?? BUNDLED_CATALOG;
      if (cachedIndex && cachedIndex.length > 0) {
        setCatalog(available);
        setCatalogIsFallback(false);
        log(`index: ${cachedIndex.length} regions from cache`);
      } else {
        log(`index: no cache, seeded with ${BUNDLED_CATALOG.length} bundled regions`);
      }

      // Refresh from the network. Both halves are independently optional: an unreachable
      // index.json shouldn't stop the selected region's rules from updating.
      try {
        available = await fetchRegionIndex();
        if (cancelled) return;
        setCatalog(available);
        setCatalogIsFallback(false);
        await writeCachedIndex(available);
        log(`index: ${available.length} regions fetched from ${BASE_URL}index.json`);
      } catch (error) {
        console.warn("[region] index refresh failed; using cached or bundled catalog", error);
      }
      if (cancelled) return;

      try {
        const summary = available.find((entry) => entry.id === savedId);
        // No index entry means no URL to fetch — the cached (or bundled) rules stand.
        if (!summary) {
          log(`rules: "${savedId}" not in the catalog; keeping cached or bundled rules`);
          return;
        }
        const fresh = await fetchRegionRules(summary);
        if (cancelled || selectedIdRef.current !== savedId) return;
        setRules(fresh);
        rememberSiteUrl(savedId, fresh);
        await writeCachedRules(savedId, fresh);
        log(`rules: ${summary.displayName} v${fresh.version} (${fresh.last_updated}) from ${summary.url}`);
      } catch (error) {
        console.warn("[region] rules refresh failed; keeping current rules", error);
      }
    };

    load().catch((error: unknown) => {
      console.warn("[region] failed to restore region", error);
    });

    return () => {
      cancelled = true;
    };
    // rememberSiteUrl is a stable callback; this still runs once.
  }, [rememberSiteUrl]);

  const downloadRegion = useCallback(
    async (summary: RegionSummary, signal?: AbortSignal) => {
      const fresh = await fetchRegionRules(summary, { signal });
      await writeCachedRules(summary.id, fresh);
      // Only after the write: the set means "rules are on disk", and claiming that before
      // they are would let the picker offer a selection that reads back nothing.
      setDownloadedIds((current) => new Set(current).add(summary.id));
      rememberSiteUrl(summary.id, fresh);
      log(`downloaded ${summary.displayName} — ${Object.keys(fresh.items).length} items`);
    },
    [rememberSiteUrl],
  );

  const removeDownload = useCallback(async (regionId: string) => {
    // Both guards are also enforced in the UI (neither row is swipeable); they live here too
    // because the invariant is the store's — nothing should be able to delete the rules the
    // app is currently sorting against.
    if (regionId === selectedIdRef.current) {
      throw new Error("Can't remove the region currently in use");
    }
    if (regionId === BUNDLED_REGION_ID) {
      throw new Error("The bundled region ships in the app and can't be removed");
    }
    await deleteCachedRules(regionId);
    setDownloadedIds((current) => {
      const next = new Set(current);
      next.delete(regionId);
      return next;
    });
    setSiteUrls((current) => {
      const next = { ...current };
      delete next[regionId];
      return next;
    });
    log(`removed download ${regionId}`);
  }, []);

  const selectRegion = useCallback(
    async (summary: RegionSummary) => {
      // Cache-only, which is what makes switching work offline. The picker only offers this
      // for downloaded regions, so the read should always hit; the fetch is a repair path for
      // the one case it can't (a cache entry evicted or corrupted since the list was built),
      // not the normal route.
      let next = await readCachedRules(summary.id);
      if (!next) {
        console.warn(`[region] no cached rules for "${summary.id}"; re-fetching`);
        next = await fetchRegionRules(summary);
        await writeCachedRules(summary.id, next);
        setDownloadedIds((current) => new Set(current).add(summary.id));
      }
      rememberSiteUrl(summary.id, next);
      log(`selected ${summary.displayName} — ${Object.keys(next.items).length} items`);
      setSelectedId(summary.id);
      selectedIdRef.current = summary.id;
      setRules(next);
      // Persistence is best-effort — the selection is already live in memory either way.
      await setString(StorageKeys.selectedRegionId, summary.id).catch((error: unknown) => {
        console.warn("[region] failed to persist region selection", error);
      });
    },
    [rememberSiteUrl],
  );

  /**
   * The manual "check for updates" path. Unlike the refresh on mount, this bypasses the HTTP
   * cache — the whole reason to press it is that something changed in bingoDB in the last few
   * minutes, which is exactly the window the cache would hide.
   *
   * Sequential, not parallel: this is a courtesy-hosted static site, and a burst of requests
   * per tap is the kind of thing that gets an app rate-limited. It also keeps the failure
   * report legible — one region failing doesn't cancel the rest.
   */
  const refreshDownloadedRules = useCallback(async (): Promise<RefreshReport> => {
    const activeId = selectedIdRef.current;

    // Index first: it's where the rules URLs come from, and refreshing it means a region
    // published since launch shows up in the picker on the same tap. Optional, though —
    // an unreachable index shouldn't stop the downloaded regions from updating.
    let available = catalogRef.current;
    try {
      available = await fetchRegionIndex({ fresh: true });
      setCatalog(available);
      setCatalogIsFallback(false);
      await writeCachedIndex(available);
    } catch (error) {
      console.warn("[region] index refresh failed; refreshing rules off the current catalog", error);
    }

    const targets = available.filter((entry) => downloadedIdsRef.current.has(entry.id));
    const activeSummary = available.find((entry) => entry.id === activeId);
    if (!activeSummary) {
      throw new Error(`No catalog entry for "${activeId}" — nothing to refresh from`);
    }

    let refreshed = 0;
    let activeRules: RegionRules | null = null;
    const failed: string[] = [];

    for (const summary of targets) {
      try {
        const fresh = await fetchRegionRules(summary, { fresh: true });
        await writeCachedRules(summary.id, fresh);
        rememberSiteUrl(summary.id, fresh);
        refreshed += 1;
        if (summary.id === activeId) activeRules = fresh;
        log(`rules: refreshed ${summary.displayName} v${fresh.version} (${fresh.last_updated})`);
      } catch (error) {
        console.warn(`[region] refresh failed for ${summary.id}`, error);
        failed.push(summary.displayName);
      }
    }

    // The active region failing is the only case worth failing the whole call for — it's the
    // one the user is looking at, and reporting "2 regions updated" would bury it.
    if (!activeRules) {
      throw new Error(`Couldn't refresh the active region (${activeSummary.displayName})`);
    }
    // Switching regions mid-refresh is only reachable by leaving the screen the button is
    // on, but applying a stale region's rules over the new one would be the worse bug.
    if (selectedIdRef.current === activeId) setRules(activeRules);

    return { refreshed, failed, active: activeRules };
  }, [rememberSiteUrl]);

  const value = useMemo<RegionValue>(
    () => ({
      rules,
      selectedId,
      catalog,
      catalogIsFallback,
      downloadedIds,
      siteUrls,
      downloadRegion,
      removeDownload,
      selectRegion,
      refreshDownloadedRules,
    }),
    [
      rules,
      selectedId,
      catalog,
      catalogIsFallback,
      downloadedIds,
      siteUrls,
      downloadRegion,
      removeDownload,
      selectRegion,
      refreshDownloadedRules,
    ],
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionValue {
  const ctx = useContext(RegionContext);
  if (!ctx) {
    throw new Error("useRegion must be used within a RegionProvider");
  }
  return ctx;
}

/** Shorthand for the common case: components that only need the active rules. */
export function useRegionRules(): RegionRules {
  return useRegion().rules;
}
