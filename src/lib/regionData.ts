import sortingData from "@/assets/data/canada/ontario/toronto.json";
import type { BinType } from "@/lib/bins";

export type BinResult = {
  bin: BinType;
  notes: string;
  link?: string;
};

/**
 * The region the loaded rules describe. Reads the file's own `region_name` rather
 * than restating it, so this stays correct once the region file is chosen at
 * runtime instead of being a fixed import.
 */
export function getRegionName(): string {
  return sortingData.region_name;
}

export function getBinForItem(itemKey: string): BinResult | null {
  const item = sortingData.items[itemKey as keyof typeof sortingData.items];
  return (item as BinResult) ?? null;
}

// Notes shown for a recognized object that isn't in the region's rules. Temporary: while
// the bundled model is the COCO base detector (see classifier.ts), it names generic objects
// that no region lists, so those all land here.
const CONSULT_GUIDE_NOTES =
  "This item isn't in the local sorting rules yet. Check your municipality's disposal guide to be sure where it goes.";

/**
 * Resolve a scan to a displayable result. Real region rule when the key is known; otherwise
 * a "consult local guide" fallback so every recognized object still produces a result and
 * a history row. Used by the scan flow and the result sheet — `getBinForItem` itself stays
 * strict (null for unknown) so genuine lookups elsewhere aren't masked.
 */
export function resolveScanResult(itemKey: string): BinResult {
  return getBinForItem(itemKey) ?? { bin: "consult_local_guide", notes: CONSULT_GUIDE_NOTES };
}

export function getItemKeys(): string[] {
  return Object.keys(sortingData.items);
}

export function formatItemName(itemKey: string): string {
  return itemKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
