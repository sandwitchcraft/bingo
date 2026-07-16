import sortingData from "@/assets/data/canada/ontario/toronto.json";
import type { BinType } from "@/lib/bins";

export type BinResult = {
  bin: BinType;
  notes: string;
  link?: string;
};

// Emoji shown in the scan-result item header. Covers the current Toronto item set;
// falls back to a generic box for anything unmapped.
const ITEM_EMOJI: Record<string, string> = {
  plastic_bottle: "🧴",
  aluminum_can: "🥫",
  glass_jar: "🫙",
  wrapper: "🍬",
  printer_paper: "📄",
  styrofoam: "📦",
  food_waste: "🍎",
  plastic_bag: "🛍️",
  diapers: "🧷",
  battery: "🔋",
};

export function getBinForItem(itemKey: string): BinResult | null {
  const item = sortingData.items[itemKey as keyof typeof sortingData.items];
  return (item as BinResult) ?? null;
}

export function getItemEmoji(itemKey: string): string {
  return ITEM_EMOJI[itemKey] ?? "📦";
}

export function formatItemName(itemKey: string): string {
  return itemKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
