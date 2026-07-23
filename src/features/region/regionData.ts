import type { BinType } from "@/core/bins";
import type { RegionItem, RegionRules } from "@/features/region/regionSource";

/**
 * Lookups over one region's rules. Every function takes the rules explicitly rather than
 * reading a module-level import: the active region is chosen at runtime and can change
 * while the app is open, so it lives in React state (`regionStore.tsx`) and is passed in.
 * Keeping these pure means the dev seed and the result sheet can share them unchanged.
 */

export type BinResult = RegionItem;

export function getRegionName(rules: RegionRules): string {
  return rules.district_name;
}

export function getBinForItem(rules: RegionRules, itemKey: string): BinResult | null {
  return rules.items[itemKey] ?? null;
}

// Notes shown for a recognized object that isn't in the region's rules. Still load-bearing:
// the bundled ImageNet model (see classifier.ts) names 1000 classes, only a handful of which
// map to item keys, so everything else — plus the material distinctions it can't make at all —
// lands here.
const CONSULT_GUIDE_NOTES =
  "This item isn't in the local sorting rules yet. Check your municipality's disposal guide to be sure where it goes.";

/**
 * Resolve a scan to a displayable result. Real region rule when the key is known; otherwise
 * a "check local guide" fallback so every recognized object still produces a result and
 * a history row. Used by the scan flow and the result sheet — `getBinForItem` itself stays
 * strict (null for unknown) so genuine lookups elsewhere aren't masked.
 */
export function resolveScanResult(rules: RegionRules, itemKey: string): BinResult {
  return (
    getBinForItem(rules, itemKey) ?? {
      display_name: formatItemName(itemKey),
      bin: "check-local-guide" satisfies BinType,
      description: CONSULT_GUIDE_NOTES,
      // The region's own waste-authority page is the best available "where do I look"
      // answer for an item its rules don't list.
      ...(rules.site_url ? { link: rules.site_url } : {}),
    }
  );
}

export function getItemKeys(rules: RegionRules): string[] {
  return Object.keys(rules.items);
}

/**
 * Any item key the active region knows about. Dev affordance, not a classifier stand-in:
 * it's how you confirm the app is reading the region you actually selected. The bundled
 * ImageNet model reaches some keys now, but not the material-dependent ones
 * (styrofoam/takeout/batteries), so this is still the only way to exercise those.
 * Switching regions changes what this can return.
 */
export function getRandomItemKey(rules: RegionRules): string | null {
  const keys = getItemKeys(rules);
  if (keys.length === 0) return null;
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Title-cases a raw item key. Handles both separators on purpose: bingoDB keys are
 * kebab-case ("plastic-bottle"), while `labelToItemKey` in classifier.ts still emits
 * snake_case for model labels it can't map to a key, and older history rows are snake_case.
 */
export function formatItemName(itemKey: string): string {
  return itemKey
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The name to show for an item key. Prefers the region's own `display_name` — it's
 * copy-edited ("Styrofoam Takeout Container"), where `formatItemName` only mechanically
 * title-cases. Falls back for keys this region doesn't list, which includes history rows
 * scanned under a different region.
 */
export function getItemDisplayName(rules: RegionRules, itemKey: string): string {
  return rules.items[itemKey]?.display_name ?? formatItemName(itemKey);
}
