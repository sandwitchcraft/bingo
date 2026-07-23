import { binColors } from "@/lib/brand";

/**
 * The bin vocabulary, defined by bingoDB — these are the exact `bin` strings the remote
 * region files emit (see `regionSource.ts`), not names chosen here. Adding a bin means the
 * database added one; anything unrecognized is coerced to "check-local-guide" on parse so
 * the UI never has to render a bin it has no color or label for.
 */
export type BinType = "recycling" | "garbage" | "organics" | "check-local-guide";

export const BIN_LABEL: Record<BinType, string> = {
  recycling: "Recycling",
  garbage: "Garbage",
  organics: "Organics",
  "check-local-guide": "Consult Local Guide",
};

/**
 * Indicator color for a bin outcome. Always resolve through here (or `binColors`)
 * so a bin's color changes in one place — never hardcode a bin hex per screen.
 */
export function binColor(bin: BinType): string {
  return binColors[bin];
}

// Hex alpha suffixes. The badge tint sits in the brand's 14-16% band; the card
// fill is lighter and the hairline heavier so the outcome color reads as an
// indicator rather than a block of color.
const ALPHA = {
  badge: "24", // ~14%
  fill: "14", //  ~8%
  border: "40", // ~25%
} as const;

export function binTint(bin: BinType, level: keyof typeof ALPHA): string {
  return `${binColors[bin]}${ALPHA[level]}`;
}

/**
 * Tinted surface for a bin result card. Alpha-based, so it composites correctly
 * over either theme's background without a separate light/dark palette.
 */
export function binSurface(bin: BinType): { bg: string; border: string } {
  return { bg: binTint(bin, "fill"), border: binTint(bin, "border") };
}
