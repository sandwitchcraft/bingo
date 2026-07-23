import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Typed JSON wrapper over AsyncStorage.
 *
 * Deliberately forgiving: every read swallows its error and returns null. Persisted
 * preferences are a cache of a decision, never the only copy of anything — a corrupt or
 * unreadable value should degrade to "no preference saved", not throw on app launch.
 * Callers that need to know a write failed can await `setJSON`, which does reject.
 */

/** Namespaced so a future storage inspector can tell our keys from a library's. */
export const StorageKeys = {
  selectedRegionId: "bingo.region.selectedId",
  regionIndex: "bingo.region.index",
  /**
   * The prefix and the key builder are defined together because the set of downloaded
   * regions is derived by scanning for this prefix (`listDownloadedRegionIds`) — if the two
   * ever disagreed, downloads would exist that the picker couldn't see.
   */
  regionRulesPrefix: "bingo.region.rules.",
  /** One entry per region, so switching back to a previous region is instant and offline. */
  regionRules: (regionId: string) => `bingo.region.rules.${regionId}`,
} as const;

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (error) {
    console.warn(`[storage] failed to read ${key}`, error);
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn(`[storage] failed to read ${key}`, error);
    return null;
  }
}

export async function setString(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

/**
 * Every key under `prefix`. A read, so it follows the forgiving contract above: an
 * unreadable store reports "nothing stored" rather than throwing. For the caller that
 * matters — `listDownloadedRegionIds` — that degrades to "no downloads yet", which is
 * recoverable by re-downloading, where a throw would break the picker outright.
 */
export async function listKeys(prefix: string): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((key) => key.startsWith(prefix));
  } catch (error) {
    console.warn(`[storage] failed to list keys for ${prefix}`, error);
    return [];
  }
}

/** Rejects on failure — a delete the user asked for shouldn't fail silently. */
export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
