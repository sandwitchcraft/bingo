# Bin-go — Brand Implementation Guide

Read this before implementing any UI. Two companion files sit alongside this one:

- `design-tokens.json` — full machine-readable token spec (colors, type, radii, voice, exclusions)
- `theme.ts` — ready-to-import React Native/Expo constants derived from the tokens above

Never hardcode a hex value or font name in a component.

**How this maps into the app.** `docs/branding/theme.ts` is mirrored at `src/lib/brand.ts`,
which is the copy the app actually imports — the two must be kept identical, and the mirror
is the thing most likely to rot, so change both together. `src/lib/theme.ts` layers the
semantic light/dark themes on top of those raw tokens and re-exports everything, so
components import only from `@/lib/theme` and never reach for `brand.ts` directly.

Values that this guide fixes (the brand tokens) live in `brand.ts`. Values the brand leaves
open — the lifted/recessed dark surfaces, hairlines, muted text — are *derived* in
`theme.ts` and are marked as derived there. Don't promote a derived value to a token
without deciding it's a brand decision.

## Logo

- Wordmark: **`bin·go`**, lowercase only, middle-dot separator (`·`), dot always colored `sprout` (`#39B378`).
- No other casing (title case, sentence case), no hyphen separator, no icon/symbol mark. This was explicitly decided after comparing five variants, lowercase-with-dot is final.

## Color

- **Sprout** (`#39B378`) / **Sprout Deep** (`#218A5A`): brand accent and primary buttons. Sprout Deep specifically for button backgrounds, it's calmer than raw Sprout.
- **Harbor** (`#3E8BD6`): reserved for recycling bin indicators only. Do not reuse as a general UI accent.
- **Clay** (`#D77930`): reserved for garbage indicators only. Deepened from the original
  `#DB7B31`, which missed the AA contrast floor on paper (see **Contrast** below).
- **Ink** (`#141A18`): dark mode background, light mode text. Deepened from the original
  `#1E2B27`, which was a dark *green* (`hsl(162°, 18%, 14%)`) and read as such across a full
  screen. Ink's hue is still green, just far darker, so on dark it must be used as the
  background *itself* — lifting it to separate a surface reads as green again. Separate
  surfaces with hairlines, or recess below ink.
- **Slate** (`#5B6B66`): secondary/muted text, and the consult-local-guide indicator.
  Consult is a deferral rather than a disposal outcome, so it reads neutral and must not
  share garbage's clay.
- **Paper** (`#FAFAF8`): light mode background.

Bin-outcome colors should always be looked up via the `binColors` map in `theme.ts`, not hardcoded per-screen, so a color change only needs to happen in one place.

### Contrast

Bin colors are **indicators**, not text colors. They may carry a badge, a hairline, a tint,
or a large label (the item name at 26px ExtraBold, the bin label at 20px Bold). They must
never colour body copy or a 10px eyebrow — those use the theme's text tokens, which is why
`binColors` deliberately has no "text" variant.

That split exists because a saturated mid-tone can't clear the AA floor for normal text
(4.5:1) against either background without going so dark it stops reading as itself. As
large text (≥24px, or ≥18.66px bold) the floor is **3.0:1**, which every bin colour now
clears in both themes:

| Outcome | Colour | on Paper | on Ink |
|---|---|---|---|
| Recycling | Harbor `#3E8BD6` | 3.42:1 | 4.93:1 |
| Compost | Sprout Deep `#218A5A` | 4.15:1 | 4.07:1 |
| Garbage | Clay `#D77930` | 3.01:1 | 5.60:1 |
| Consult | Slate `#5B6B66` | 5.37:1 | 3.14:1 |

Two of those numbers are why tokens moved: Clay's original `#DB7B31` sat at 2.92:1 on paper,
and Slate sat at 2.62:1 against the original Ink.

**Re-measure this table before changing Clay, Slate, Ink, or Paper.** Headroom above the
floor is thin and unevenly distributed:

- **Clay: +0.01** — passing by the smallest possible margin. Any lightening of Clay, or any
  darkening of Paper, drops it below 3.0:1. Treat `#D77930` as a hard floor, not a
  preference; if Clay must get warmer or lighter, the item name has to stop carrying the
  outcome colour on light.
- **Slate: +0.14** — depends on Ink staying at or below `#141A18`. Lightening Ink breaks it.
- Recycling (+0.42) and Compost (+1.07) have real room.

Light mode is the binding constraint for warm colours; dark mode binds the neutrals. A
change that looks safe in one theme routinely breaks the other, so check both.

## Typography

Three families, each with one job:
- **Manrope** (800/700) — display and headings only.
- **Inter** (400/600) — body copy only.
- **IBM Plex Mono** (500/600) — every label, eyebrow, timestamp, or metadata string. There is no separate "label" style in Inter, this was consolidated during design review, Mono covers all utility text.

## Components

- Buttons are **full pill shape** (`border-radius: 999`), not rounded rectangles.
- Primary button uses Sprout Deep, not raw Sprout, intentionally toned down from an earlier brighter version.
- Secondary button uses a soft tinted fill (`rgba(57,179,120,0.10)`), not an outline, per design feedback that outlined buttons read as "foreboding."
- Cards use `18px` border radius, `1px` border in `line` color (`#E7E5DE`).

## Pictograms

- Single-weight line icons (~1.8px stroke), no fill except a circular background badge.
- Badge is tinted at ~14-16% opacity of the **bin outcome color**, not a fixed material color, e.g. a plastic bottle's badge is tinted Harbor (recycling), not "plastic blue" as an independent color choice. This lets the icon teach the sort result at a glance.

## Voice

Instructional and direct. No exclamation points, no congratulatory filler.
- Use: `"Rinse before disposal."` / `"Item not recognized. Try a clearer angle."` / `"Scanned. Saved to history."`
- Avoid: `"Give it a quick rinse first!"` / `"Oops, we couldn't recognize that."` / `"Great job scanning your first item!"`

## Explicitly excluded

These were tried and rejected during design iteration, do not reintroduce them:
- Stamp/badge motifs on the result screen
- Any "bingo" game visual references (cards, grids, dabbers) despite the app name
- Amber/yellow as an accent color
- Scan-line or beacon sweep animations
- Mascot or illustrated characters

## Reference mood

Closer to Yuka (calm, light, single-accent-driven, credible-but-friendly) than to municipal signage or a gamified habit-tracker. Light mode is primary; dark mode is a supported secondary, not the default.
