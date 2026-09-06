/**
 * The bin vocabulary as the app uses it. This mostly mirrors bingoDB's `bin` strings, with
 * one deliberate exception: the database's `organics` is normalized to `compost` on the way
 * in (`BIN_WIRE_ALIASES` / `toBinType` in `regionSource.ts`). Adding a bin still means the
 * database added one; anything unrecognized is coerced to "consult-local-guide" on parse so
 * the UI never has to render a bin it has no colour or label for.
 *
 * Colour is not defined here. `core/` is React- and design-free; a bin's swatch depends on the
 * active theme (dark mode lifts every fill to its lighter step), so it lives on the `Theme`
 * object — `theme.bins[bin]` — in `src/ui/theme.ts`.
 */
export type BinType = "recycling" | "garbage" | "compost" | "consult-local-guide";

/** Sentence case, per the voice rules: uppercase belongs only in mono stamps. */
export const BIN_LABEL: Record<BinType, string> = {
  recycling: "Recycling",
  garbage: "Garbage",
  compost: "Compost",
  "consult-local-guide": "Consult local guide",
};

/** The short form a list row or chip uses next to an item name. */
export const BIN_SHORT_LABEL: Record<BinType, string> = {
  recycling: "Recycling",
  garbage: "Garbage",
  compost: "Compost",
  "consult-local-guide": "Check guide",
};

/** Every bin, in the order the UI lists them (organics first, since green is also the accent). */
export const BIN_ORDER: readonly BinType[] = ["compost", "recycling", "garbage", "consult-local-guide"];
