import type { RegionItem, RegionRules } from "@/features/region/regionSource";

/**
 * Text search over one region's item catalog. React-free and pure — like the region and
 * scan data helpers, it takes the active `RegionRules` explicitly rather than reading a
 * module import, so the Search screen (and any test) can call it off the render path.
 *
 * The active region changes at runtime, so what this can return changes with it.
 */

export type ItemHit = { itemKey: string; item: RegionItem };

/**
 * Fold a string down to a comparable form: lowercase, and drop the separators that differ
 * between how a key is written and how someone types it. Item keys are kebab-case and some
 * carry parens ("plant-pot-(plastic)"), so `-`, `_`, `(` and `)` all collapse to spaces —
 * that way "plant pot" and "plastic" both find that key.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[-_()]+/g, " ").replace(/\s+/g, " ").trim();
}

// Ranking tiers, lower sorts first. A match on the display name outranks one on a registry
// keyword ("pop" → Aluminum Beverage Can), which outranks one that only hit the description,
// and a name the query is a prefix of outranks a mid-word hit — so "bat" surfaces
// "Batteries" above an item that merely mentions batteries in its notes.
const RANK = { namePrefix: 0, nameSubstring: 1, keyword: 2, descriptionOnly: 3 } as const;

function rankOf(needle: string, item: RegionItem): number | null {
  const name = normalize(item.display_name);
  if (name.startsWith(needle)) return RANK.namePrefix;
  if (name.includes(needle)) return RANK.nameSubstring;
  if (item.keywords?.some((keyword) => normalize(keyword).includes(needle))) return RANK.keyword;
  if (normalize(item.description).includes(needle)) return RANK.descriptionOnly;
  return null;
}

/**
 * Items matching `query`, best matches first. An empty query returns the whole catalog
 * sorted by display name — that's the full list the Search screen shows once it's active.
 * Within a rank, results are ordered alphabetically by display name so the list is stable.
 */
export function searchItems(rules: RegionRules, query: string): ItemHit[] {
  const all: ItemHit[] = Object.entries(rules.items).map(([itemKey, item]) => ({
    itemKey,
    item,
  }));

  const byName = (a: ItemHit, b: ItemHit) =>
    a.item.display_name.localeCompare(b.item.display_name);

  const needle = normalize(query);
  if (needle === "") return all.sort(byName);

  // Also match against the key itself, so a key whose display name diverges from its slug
  // is still reachable by typing the slug.
  return all
    .map((hit) => {
      const keyRank = normalize(hit.itemKey).includes(needle) ? RANK.nameSubstring : null;
      const contentRank = rankOf(needle, hit.item);
      const rank =
        keyRank == null ? contentRank : Math.min(keyRank, contentRank ?? keyRank);
      return rank == null ? null : { hit, rank };
    })
    .filter((r): r is { hit: ItemHit; rank: number } => r != null)
    .sort((a, b) => a.rank - b.rank || byName(a.hit, b.hit))
    .map((r) => r.hit);
}
