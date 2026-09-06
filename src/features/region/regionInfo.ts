/**
 * Per-region "home base" content for the Location tab: notices a region wants to publish
 * (holiday schedules, program changes, contamination warnings) and its verdict on each of
 * the seven plastic resin codes.
 *
 * Sourced from `RegionRules.notices` / `RegionRules.plastics` (bingoDB fields, hand-maintained
 * there for now — see `csv_to_json.py`'s `HAND_MAINTAINED_FIELDS`). `getRegionInfo` is the
 * only read path; a region that hasn't published either comes back as `EMPTY` rather than
 * undefined, so the screen has a state to render instead of an error to guard against.
 *
 * The verdicts are typed as `BinType` rather than a bespoke accept/reject enum, so the
 * plastics grid can reuse `theme.bins[bin]` and a "not accepted" code reads in the same
 * black tint as a garbage result elsewhere in the app. `consult-local-guide` is the honest
 * default for anything a region hasn't stated.
 */
import type {
  PlasticCode,
  PlasticVerdict,
  RegionNotice,
  RegionRules,
} from "@/features/region/regionSource";

export type { PlasticCode, PlasticVerdict, RegionNotice };

export type RegionInfo = {
  notices: RegionNotice[];
  plastics: Partial<Record<PlasticCode, PlasticVerdict>>;
};

/**
 * What each resin code *is* — region-independent reference. `examples` are the everyday
 * items someone is most likely holding when they look the code up.
 */
/** The generic recycling symbol (U+267A), for the section that introduces the codes. */
export const RECYCLING_SYMBOL = "♺";

export const PLASTIC_CODES: {
  code: PlasticCode;
  /** The resin-code glyph (U+2673–U+2679): the triangle with the number inside, as printed. */
  symbol: string;
  abbreviation: string;
  name: string;
  examples: string;
}[] = [
  { code: 1, symbol: "♳", abbreviation: "PET", name: "Polyethylene terephthalate", examples: "Water and pop bottles, clamshell produce boxes" },
  { code: 2, symbol: "♴", abbreviation: "HDPE", name: "High-density polyethylene", examples: "Milk jugs, detergent and shampoo bottles" },
  { code: 3, symbol: "♵", abbreviation: "PVC", name: "Polyvinyl chloride", examples: "Blister packs, some cling wrap, pipe" },
  { code: 4, symbol: "♶", abbreviation: "LDPE", name: "Low-density polyethylene", examples: "Grocery bags, bread bags, squeeze bottles" },
  { code: 5, symbol: "♷", abbreviation: "PP", name: "Polypropylene", examples: "Yogurt tubs, bottle caps, takeout containers" },
  { code: 6, symbol: "♸", abbreviation: "PS", name: "Polystyrene", examples: "Foam cups and trays, plastic cutlery" },
  { code: 7, symbol: "♹", abbreviation: "OTHER", name: "Other / mixed", examples: "Large water cooler jugs, some reusable bottles" },
];

const NOT_STATED: PlasticVerdict = {
  bin: "consult-local-guide",
  note: "This region hasn't published guidance for this code.",
};

const EMPTY: RegionInfo = { notices: [], plastics: {} };

/** The published content for a region's rules, or `EMPTY` when it hasn't published any. */
export function getRegionInfo(rules: Pick<RegionRules, "notices" | "plastics">): RegionInfo {
  if (!rules.notices.length && !Object.keys(rules.plastics).length) return EMPTY;
  return { notices: rules.notices, plastics: rules.plastics };
}

/** The verdict for one code, falling back to an explicit "not stated" rather than undefined. */
export function plasticVerdict(info: RegionInfo, code: PlasticCode): PlasticVerdict {
  return info.plastics[code] ?? NOT_STATED;
}

/** Newest first. Dates are ISO day strings, so a string compare orders them correctly. */
export function sortedNotices(info: RegionInfo): RegionNotice[] {
  return [...info.notices].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
