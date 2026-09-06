import bundledToronto from "@/assets/data/canada/ontario/toronto/toronto.json";
import bundledRegistry from "@/assets/data/items.json";
import type { BinType } from "@/core/bins";
import { fetchJSON } from "@/core/net";
import { getJSON, listKeys, removeKey, setJSON, StorageKeys } from "@/core/storage";

/**
 * bingoDB — the remote sorting-rules database. React-free on purpose (same as `db.ts`):
 * fetching, validating and caching live here, and `regionStore.tsx` owns the state.
 *
 * Layout: an index at the root lists every region; each entry's `url` is relative to the
 * base. GitHub Pages can't list directories, so the index is the ONLY way to discover what
 * exists. It is always fetched and never bundled — `parseRegionIndex` below is this repo's
 * statement of the contract: `id` and `url` are the only required fields, everything else is
 * derived when absent, and an entry missing those is skipped rather than failing the whole
 * index. bingoDB owns the schema; the app parses what it emits and doesn't rename its fields.
 */
export const BASE_URL = "https://sandwitchcraft.github.io/bingoDB/";

const INDEX_PATH = "index.json";
const REGISTRY_PATH = "items.json";

/**
 * One entry in bingoDB's global item registry (`items.json`). The registry owns what an
 * item *is* — its name, search keywords and material family — and a region's rules file
 * only says which bin it goes in. That split is deliberate: it stops two regions from
 * naming the same key differently, and it's why `RegionItem.display_name` is filled in
 * from here (`applyRegistry`) rather than trusted from the region file.
 */
export type RegistryItem = {
  display_name: string;
  keywords: string[];
  /** A slug from the registry's `materials` list ("plastic", "organic", …). */
  material: string;
};

export type ItemRegistry = {
  generated_at: string;
  items: Record<string, RegistryItem>;
};

/**
 * Which kind of waste provider a region entry describes. Most regions are `municipal`
 * (the residential collection a place's own authority runs) — that's the default whenever
 * the field is absent, which is what keeps older index entries valid. A `commercial`
 * provider is a private hauler that operates across a broader scope with its own rules;
 * these are chosen manually and are deliberately excluded from location auto-detect.
 */
export type ProviderType = "municipal" | "commercial";

/** One entry in the index — enough to render a picker row without fetching the rules. */
export type RegionSummary = {
  /**
   * Stable identity, doubles as the cache key. Municipal entries are path-shaped
   * ("canada/ontario/toronto"); a commercial provider carries a `@<provider_id>` suffix on
   * its geographic scope ("canada/ontario@republic-services"), which is why `id` is not
   * assumed equal to `path.join("/")`.
   */
  id: string;
  displayName: string;
  level: string;
  /**
   * The provider's geographic *scope*, root-first folder slugs. For a commercial provider
   * this is the area it covers (e.g. `["canada","ontario"]`), not a place with that id.
   */
  path: string[];
  /** Readable ancestor labels ("Canada", "Ontario"), title-cased from `path` if absent. */
  parents: string[];
  /** `municipal` unless the entry says otherwise. */
  providerType: ProviderType;
  /** The slug after `@` in a commercial `id`; absent for municipal entries. */
  providerId?: string;
  /** Provider label, so a commercial row can be named without downloading its rules. */
  providerName?: string;
  /** Rules version/date from the index, used to skip an unchanged region's rules fetch. */
  version?: string;
  lastUpdated?: string;
  /** Absolute, already joined against BASE_URL. */
  url: string;
};

export type RegionItem = {
  /**
   * Registry name when the key is in the registry (the common case), else the region's own
   * name, else the title-cased key. Region files only carry a `display_name` for keys the
   * registry doesn't define yet.
   */
  display_name: string;
  bin: BinType;
  description: string;
  /** Not emitted by every region — the consult-guide rows carry it. */
  link?: string;
  /** From the registry via `applyRegistry`; absent for keys the registry doesn't define. */
  keywords?: string[];
  material?: string;
};

/** One published notice (holiday schedules, program changes, contamination warnings). */
export type RegionNotice = {
  id: string;
  title: string;
  body: string;
  /** ISO `YYYY-MM-DD`, same as the rules file's `last_updated`. */
  date: string;
  /** Drives the badge: `alert` for something to act on, `info` for everything else. */
  kind: "info" | "alert";
  /** Optional deep link into the provider's own site. */
  link?: string;
};

export type PlasticCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A region's verdict on one resin code, with an optional one-line qualifier. */
export type PlasticVerdict = {
  bin: BinType;
  note?: string;
};

export type RegionRules = {
  district_name: string;
  provider_name: string;
  /**
   * Empty for a municipal provider (deliberately — it keeps `getRegionPath`'s backend key a
   * bare path); a slug like `"republic-services"` for a commercial one, which is what
   * disambiguates two providers that share a `location_path`.
   */
  provider_id: string;
  provider_type: ProviderType;
  site_url: string;
  last_updated: string;
  version: string;
  location_path: string[];
  /** Hand-maintained on the bingoDB side for now (no Notion source yet) — absent ⇒ none. */
  notices: RegionNotice[];
  /** Hand-maintained on the bingoDB side for now (no Notion source yet) — absent ⇒ none. */
  plastics: Partial<Record<PlasticCode, PlasticVerdict>>;
  items: Record<string, RegionItem>;
};

const BIN_TYPES: readonly BinType[] = ["recycling", "garbage", "compost", "consult-local-guide"];

/**
 * The one place bingoDB's bin vocabulary and `BinType` disagree: the database emits
 * `organics`, the app says `compost`. Normalizing here — at the single parse boundary every
 * rules file passes through, bundled snapshot included — keeps that difference from leaking
 * anywhere else, and means the DB can adopt `compost` later without a second change here.
 */
const BIN_WIRE_ALIASES: Record<string, BinType> = { organics: "compost" };

/**
 * Bins are data, so an unrecognized value is a database change we haven't shipped for — not
 * a bug to crash on. Deferring to the local guide is the honest answer in that case, and it
 * keeps every downstream consumer (colors, labels, icons) total over BinType.
 */
function toBinType(value: unknown): BinType {
  if (typeof value === "string" && value in BIN_WIRE_ALIASES) return BIN_WIRE_ALIASES[value];
  return BIN_TYPES.includes(value as BinType) ? (value as BinType) : "consult-local-guide";
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Joins a possibly-absolute index `url` onto the base without doubling slashes. */
function resolveUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : BASE_URL + url.replace(/^\//, "");
}

/**
 * Skips malformed entries rather than rejecting the whole index: one bad row generated
 * upstream shouldn't cost the user every other region.
 */
export function parseRegionIndex(raw: unknown): RegionSummary[] {
  if (!isRecord(raw) || !Array.isArray(raw.regions)) return [];

  const regions: RegionSummary[] = [];
  for (const entry of raw.regions) {
    if (!isRecord(entry)) continue;
    const { id, url } = entry;
    if (typeof id !== "string" || !id || typeof url !== "string" || !url) continue;

    const path = asStringArray(entry.path);
    const parents = asStringArray(entry.parents);
    regions.push({
      id,
      displayName:
        typeof entry.display_name === "string" && entry.display_name
          ? entry.display_name
          : titleCase(path[path.length - 1] ?? id),
      level: typeof entry.level === "string" ? entry.level : "",
      path,
      // `parents` is optional in the contract, so derive it when the generator omits it.
      parents: parents.length > 0 ? parents : path.slice(0, -1).map(titleCase),
      // Anything but an explicit "commercial" is municipal — the safe default, since
      // municipal is the only kind location auto-detect will match.
      providerType: entry.provider_type === "commercial" ? "commercial" : "municipal",
      providerId:
        typeof entry.provider_id === "string" && entry.provider_id ? entry.provider_id : undefined,
      providerName:
        typeof entry.provider_name === "string" && entry.provider_name
          ? entry.provider_name
          : undefined,
      version: typeof entry.version === "string" && entry.version ? entry.version : undefined,
      lastUpdated:
        typeof entry.last_updated === "string" && entry.last_updated ? entry.last_updated : undefined,
      url: resolveUrl(url),
    });
  }
  return regions;
}

const NOTICE_KINDS = new Set(["info", "alert"]);

/** Skips a malformed notice rather than rejecting the whole file over one bad entry. */
function parseNotices(raw: unknown): RegionNotice[] {
  if (!Array.isArray(raw)) return [];
  const notices: RegionNotice[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const { id, title, body, date, kind } = entry;
    if (
      typeof id !== "string" || !id ||
      typeof title !== "string" || !title ||
      typeof body !== "string" ||
      typeof date !== "string" ||
      !NOTICE_KINDS.has(kind as string)
    ) continue;
    notices.push({
      id,
      title,
      body,
      date,
      kind: kind as "info" | "alert",
      ...(typeof entry.link === "string" ? { link: entry.link } : {}),
    });
  }
  return notices;
}

/** Only "1".."7" keys with a recognized bin are kept — anything else is silently dropped. */
function parsePlastics(raw: unknown): Partial<Record<PlasticCode, PlasticVerdict>> {
  if (!isRecord(raw)) return {};
  const plastics: Partial<Record<PlasticCode, PlasticVerdict>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const code = Number(key);
    if (!Number.isInteger(code) || code < 1 || code > 7 || !isRecord(value)) continue;
    plastics[code as PlasticCode] = {
      bin: toBinType(value.bin),
      ...(typeof value.note === "string" ? { note: value.note } : {}),
    };
  }
  return plastics;
}

/** Throws on a shape we can't use at all — a rules file with no items is not a region. */
export function parseRegionRules(raw: unknown): RegionRules {
  if (!isRecord(raw) || !isRecord(raw.items)) {
    throw new Error("Malformed region rules: no items");
  }

  const items: Record<string, RegionItem> = {};
  for (const [key, value] of Object.entries(raw.items)) {
    if (!isRecord(value)) continue;
    items[key] = {
      display_name:
        typeof value.display_name === "string" && value.display_name
          ? value.display_name
          : titleCase(key),
      bin: toBinType(value.bin),
      description: typeof value.description === "string" ? value.description : "",
      ...(typeof value.link === "string" ? { link: value.link } : {}),
    };
  }

  const locationPath = asStringArray(raw.location_path);
  return {
    district_name: typeof raw.district_name === "string" ? raw.district_name : "",
    provider_name: typeof raw.provider_name === "string" ? raw.provider_name : "",
    provider_id: typeof raw.provider_id === "string" ? raw.provider_id : "",
    provider_type: raw.provider_type === "commercial" ? "commercial" : "municipal",
    site_url: typeof raw.site_url === "string" ? raw.site_url : "",
    last_updated: typeof raw.last_updated === "string" ? raw.last_updated : "",
    version: typeof raw.version === "string" ? raw.version : "",
    location_path: locationPath,
    notices: parseNotices(raw.notices),
    plastics: parsePlastics(raw.plastics),
    items,
  };
}

/**
 * Lenient like `parseRegionIndex`: a malformed entry is skipped, not fatal. An entry needs
 * only a non-empty `display_name` to be useful; keywords and material degrade to empty.
 */
export function parseItemRegistry(raw: unknown): ItemRegistry {
  if (!isRecord(raw) || !isRecord(raw.items)) {
    throw new Error("Malformed item registry: no items");
  }
  const items: Record<string, RegistryItem> = {};
  for (const [key, value] of Object.entries(raw.items)) {
    if (!isRecord(value) || typeof value.display_name !== "string" || !value.display_name) continue;
    items[key] = {
      display_name: value.display_name,
      keywords: asStringArray(value.keywords),
      material: typeof value.material === "string" ? value.material : "",
    };
  }
  return {
    generated_at: typeof raw.generated_at === "string" ? raw.generated_at : "",
    items,
  };
}

/**
 * Fills each region item's name (and keywords/material) from the registry. Precedence is
 * registry → region's own `display_name` → title-cased key, and the last two are already
 * collapsed by `parseRegionRules`, so this only has to overlay. Returns the same object
 * when nothing changes so a store can keep referential stability.
 */
export function applyRegistry(rules: RegionRules, registry: ItemRegistry): RegionRules {
  let changed = false;
  const items: Record<string, RegionItem> = {};
  for (const [key, item] of Object.entries(rules.items)) {
    const entry = registry.items[key];
    if (!entry) {
      items[key] = item;
      continue;
    }
    changed = true;
    items[key] = {
      ...item,
      display_name: entry.display_name,
      keywords: entry.keywords,
      material: entry.material,
    };
  }
  return changed ? { ...rules, items } : rules;
}

/**
 * GitHub Pages serves these with `cache-control: max-age=600`, and RN's fetch goes through
 * the platform HTTP cache — so for ten minutes after a fetch, a "network refresh" can be
 * answered from disk without a request leaving the device. That's the right default (it's
 * polite to the CDN and makes launches fast), but it makes a just-published correction
 * invisible, which defeats the point of hosting the rules remotely at all.
 *
 * A unique query param is the only reliable way around it here: RN's fetch ignores the
 * `cache` RequestInit option on Android, and `no-store` headers can't be set on a GET that
 * the OS has already decided to answer locally. Used only on an explicit refresh, so
 * ordinary launches still hit the cache.
 */
function bustCache(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

export async function fetchRegionIndex(options?: { fresh?: boolean }): Promise<RegionSummary[]> {
  const url = BASE_URL + INDEX_PATH;
  const regions = parseRegionIndex(await fetchJSON(options?.fresh ? bustCache(url) : url));
  if (regions.length === 0) {
    throw new Error("Region index is empty or malformed");
  }
  return regions;
}

export async function fetchRegionRules(
  summary: RegionSummary,
  options?: { fresh?: boolean; signal?: AbortSignal },
): Promise<RegionRules> {
  const url = options?.fresh ? bustCache(summary.url) : summary.url;
  return parseRegionRules(await fetchJSON(url, { signal: options?.signal }));
}

/** The registry isn't listed in the index, so there's no version to skip on — always fetched. */
export async function fetchItemRegistry(options?: { fresh?: boolean }): Promise<ItemRegistry> {
  const url = BASE_URL + REGISTRY_PATH;
  return parseItemRegistry(await fetchJSON(options?.fresh ? bustCache(url) : url));
}

// --- Cache -----------------------------------------------------------------

export function readCachedIndex(): Promise<RegionSummary[] | null> {
  return getJSON<RegionSummary[]>(StorageKeys.regionIndex);
}

export function writeCachedIndex(regions: RegionSummary[]): Promise<void> {
  return setJSON(StorageKeys.regionIndex, regions);
}

/**
 * Cached copies are re-parsed on the way out, same as a network response. The parsers are
 * idempotent on already-parsed data, and it means a field added to the schema (notices,
 * plastics, keywords) is present — defaulted — on rules an older install cached before the
 * field existed, instead of being `undefined` for every screen to guard against.
 */
function reparse<T>(raw: unknown, parse: (raw: unknown) => T, key: string): T | null {
  if (raw == null) return null;
  try {
    return parse(raw);
  } catch (error) {
    console.warn(`[storage] discarding unparseable cache entry ${key}`, error);
    return null;
  }
}

export async function readCachedRegistry(): Promise<ItemRegistry | null> {
  const key = StorageKeys.itemRegistry;
  return reparse(await getJSON(key), parseItemRegistry, key);
}

export function writeCachedRegistry(registry: ItemRegistry): Promise<void> {
  return setJSON(StorageKeys.itemRegistry, registry);
}

export async function readCachedRules(regionId: string): Promise<RegionRules | null> {
  const key = StorageKeys.regionRules(regionId);
  return reparse(await getJSON(key), parseRegionRules, key);
}

export function writeCachedRules(regionId: string, rules: RegionRules): Promise<void> {
  return setJSON(StorageKeys.regionRules(regionId), rules);
}

export function deleteCachedRules(regionId: string): Promise<void> {
  return removeKey(StorageKeys.regionRules(regionId));
}

/**
 * Each downloaded region's `site_url` — the provider's own waste page, which the picker
 * links out to. It lives in the rules file rather than the index, so it can only be known
 * for a region whose rules are on disk; regions that publish no `site_url` are omitted
 * entirely, so a caller can treat "present" as "there is somewhere to send the user".
 */
export async function readCachedSiteUrls(
  regionIds: Iterable<string>,
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    [...regionIds].map(async (id) => {
      // The bundled region has no cache entry until it's been refreshed once, but its rules
      // — and so its site_url — ship in the binary.
      const rules = (await readCachedRules(id)) ?? (id === BUNDLED_REGION_ID ? BUNDLED_RULES : null);
      return [id, rules?.site_url ?? ""] as const;
    }),
  );
  return Object.fromEntries(entries.filter(([, url]) => url !== ""));
}

/**
 * Which regions are downloaded — derived by scanning for the rules-key prefix rather than
 * kept as a separate manifest. A manifest would be a second source of truth that could drift
 * from the keys it describes (a failed write, a partial clear), and the failure mode would be
 * a region the picker calls downloaded that has no rules behind it. Scanning can't lie.
 */
export async function listDownloadedRegionIds(): Promise<string[]> {
  const keys = await listKeys(StorageKeys.regionRulesPrefix);
  return keys.map((key) => key.slice(StorageKeys.regionRulesPrefix.length));
}

// --- Bundled fallback ------------------------------------------------------

/**
 * A snapshot of the live Toronto file, shipped so a first launch with no network still
 * sorts. It goes through `parseRegionRules` like everything else — the bundle is not a
 * second schema, it's the same schema arriving from disk instead of the network.
 */
export const BUNDLED_REGION_ID = "canada/ontario/toronto";
export const BUNDLED_RULES: RegionRules = parseRegionRules(bundledToronto);

/**
 * Snapshot of `items.json`, same reasoning as the rules: the bundled region's items have no
 * names without it (the live file stopped carrying `display_name` for registry keys), so an
 * offline first launch would otherwise show title-cased slugs.
 */
export const BUNDLED_REGISTRY: ItemRegistry = parseItemRegistry(bundledRegistry);

/**
 * What the picker shows when neither the network nor the cache can supply an index.
 * A snapshot of what the database held when this shipped, not a mirror of it, so the picker
 * flags it as a partial list rather than passing it off as the full catalog. Only Toronto's
 * rules are bundled; picking anything else here still needs a network fetch.
 */
export const BUNDLED_CATALOG: RegionSummary[] = parseRegionIndex({
  regions: [
    {
      id: "canada/ontario/halton",
      display_name: "Halton",
      level: "region",
      path: ["canada", "ontario", "halton"],
      parents: ["Canada", "Ontario"],
      url: "data/canada/ontario/halton/halton.json",
    },
    {
      id: BUNDLED_REGION_ID,
      display_name: BUNDLED_RULES.district_name,
      level: "municipality",
      path: BUNDLED_RULES.location_path,
      parents: ["Canada", "Ontario"],
      url: "data/canada/ontario/toronto/toronto.json",
    },
  ],
});

/** "Ontario, Canada" — the picker's and Settings' subtitle for a region. */
export function regionSubtitle(summary: RegionSummary): string {
  return [...summary.parents].reverse().join(", ");
}
