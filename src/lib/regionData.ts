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

export function getItemKeys(): string[] {
  return Object.keys(sortingData.items);
}

/**
 * Placeholder stand-in for the classifier: returns any item the current region
 * knows about. Delete once the ML model is wired in and returns a real label.
 */
export function getRandomItemKey(): string {
  const keys = getItemKeys();
  return keys[Math.floor(Math.random() * keys.length)];
}

export function formatItemName(itemKey: string): string {
  return itemKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
