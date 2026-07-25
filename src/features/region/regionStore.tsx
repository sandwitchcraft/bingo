import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getString, setString, StorageKeys } from "@/core/storage";
import { useToast } from "@/ui/toast";
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
} from "@/features/region/regionSource";

/**
 * The selected region and its rules.
 *
 * Cache-first by design: the bundled snapshot renders immediately, storage replaces it as
 * soon as it reads back, and the network refresh lands last. A failed refresh is logged and
 * dropped — the app stays usable on whatever rules it already had, which is the whole point
 * of shipping a bundled region.
 */

/**
 * How long the app tolerates being unable to reach bingoDB before it warns the user. The
 * launch check (index + active rules) records the time it last succeeded; past this window
 * with no success, `RegionProvider` raises the stale-data toast.
 */
const RULES_CHECK_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

const STALE_RULES_MESSAGE =
  "We haven't been able to check the database for updates recently. Please go online to check for the latest info!";

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
  const { showError } = useToast();
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

      // Refresh from the network. This is the automatic "check for updates" that runs on
      // every app open — there is no manual button. Both halves are independently optional:
      // an unreachable index.json shouldn't stop the selected region's rules from updating.
      // `checkedOk` records whether either half actually reached bingoDB, which is what the
      // staleness warning below keys off — reaching the server counts even if nothing changed.
      let checkedOk = false;
      try {
        available = await fetchRegionIndex();
        if (cancelled) return;
        setCatalog(available);
        setCatalogIsFallback(false);
        await writeCachedIndex(available);
        checkedOk = true;
        log(`index: ${available.length} regions fetched from ${BASE_URL}index.json`);
      } catch (error) {
        console.warn("[region] index refresh failed; using cached or bundled catalog", error);
      }
      if (cancelled) return;

      const summary = available.find((entry) => entry.id === savedId);
      if (!summary) {
        // No index entry means no URL to fetch — the cached (or bundled) rules stand.
        log(`rules: "${savedId}" not in the catalog; keeping cached or bundled rules`);
      } else {
        try {
          const fresh = await fetchRegionRules(summary);
          checkedOk = true; // server reached, regardless of whether we still apply the result
          if (cancelled || selectedIdRef.current !== savedId) return;
          setRules(fresh);
          rememberSiteUrl(savedId, fresh);
          await writeCachedRules(savedId, fresh);
          log(`rules: ${summary.displayName} v${fresh.version} (${fresh.last_updated}) from ${summary.url}`);
        } catch (error) {
          console.warn("[region] rules refresh failed; keeping current rules", error);
        }
      }
      if (cancelled) return;

      // Record the check, or warn if we've now been unable to reach bingoDB for too long.
      const now = Date.now();
      const raw = await getString(StorageKeys.lastRulesCheck);
      const last = raw != null && raw !== "" ? Number(raw) : NaN;
      if (checkedOk || Number.isNaN(last)) {
        // Either we just checked, or this is the first launch with nothing recorded — in the
        // latter case start the clock now rather than nagging a brand-new (or freshly
        // offline) install that simply hasn't been online yet.
        await setString(StorageKeys.lastRulesCheck, String(now)).catch(() => {});
      } else if (now - last > RULES_CHECK_MAX_AGE_MS) {
        showError(STALE_RULES_MESSAGE);
      }
    };

    load().catch((error: unknown) => {
      console.warn("[region] failed to restore region", error);
    });

    return () => {
      cancelled = true;
    };
    // rememberSiteUrl and showError are stable callbacks; this still runs once.
  }, [rememberSiteUrl, showError]);

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
