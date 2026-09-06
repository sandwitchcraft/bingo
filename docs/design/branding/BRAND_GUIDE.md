# bin·go — Brand Implementation Guide

Read this before implementing any UI. Two companion files sit alongside this one:

- `design-tokens.json` — full machine-readable token spec (colours, type, radii, lid, voice, exclusions)
- `theme.ts` — ready-to-import React Native/Expo constants derived from the tokens above

The source of truth for all of it is the approved design sheet **"bin-go Color and Type v3"**
(claude.ai/design project `e72fe31c`). This guide is the sheet's rules in prose. It replaced
the Sprout/Harbor/Clay + Manrope/Inter system on 2026-09-05.

Never hardcode a hex value or font name in a component.

**How this maps into the app.** `docs/design/branding/theme.ts` is mirrored at `src/ui/brand.ts`,
which is the copy the app actually imports — the two must be kept identical, and the mirror
is the thing most likely to rot, so change both together. `src/ui/theme.ts` layers the
semantic light/dark `Theme` objects and the `TYPE` scale on top of those raw tokens and
re-exports everything, so components import only from `@/ui/theme` and never reach for
`brand.ts` directly. Shared pieces live next to it: `Button.tsx` (the three pills),
`Lid.tsx` (the lid motif), `Icons.tsx` (the functional glyphs), `Wordmark.tsx`.

## Logo

- Wordmark: **`bin·go`**, lowercase only, Bricolage Grotesque 700 tracked −0.03em, the
  interpunct in the accent green. Render `<Wordmark />`; never type the string.
- No other casing, no hyphen separator, no icon/symbol mark. If a real logo ever arrives it
  goes in `assets/` and this section changes — do not draw one.

## Colour

**One warm palette at two lightnesses.** The ground is cream (`#F5EAD8`) with warm ink
(`#211F1A`); dark mode is warm umber (`#191712`) with sand ink (`#F4ECDC`). The cream darkens
without ever cooling into grey. Every semantic token exists in both modes — read them off the
`Theme` object (`theme.bg`, `theme.card`, `theme.accent`, …), never from the palette.

**Green does double duty.** It is the app accent — every button, toggle, active state and
confirmation — *and* it is the organics lid. **Blue, black and amber appear only as an
answer**, so a colour on screen always means a bin. Don't use blue for a link or amber for a
warning.

**Bins have four colours each**, on `theme.bins[bin]`:

| | `fill` | `ink` | `tint` | `tintInk` |
|---|---|---|---|---|
| use for | the answer card, a lid bar | text on the fill | chips, notes, list rows | text on the tint |

In dark mode every fill lifts to its lighter step so the answer card takes dark ink instead of
white. `BIN_ROLE` in `brand.ts` maps bingoDB's `BinType` onto the sheet's four lid roles:
compost → green, recycling → blue, garbage → black, consult-local-guide → amber (the sheet's
"take-back / answer + caution" role — batteries, bulbs, depot glass — which is exactly what
the deferral covers).

**Alert** (`#B5432B`) is the one colour not on the sheet: the error toast and swipe-to-remove.
It exists because amber is now a bin and an error must never read as a sorting outcome. Same
fill in both themes.

**The scan screen is permanently dark** in both themes (`scanSurface` in `brand.ts`): umber
ground, sand text, a lifted-green reticle and shutter, a single cream "Looks like" card.

## Typography

Three faces, each with one job:

- **Bricolage Grotesque** (700 / 600) — display and titles. The one-word answer at 50px,
  screen titles at 32px, list titles at 17px, and **every button label**. Always negatively
  tracked. Its slightly irregular shapes keep the system warm without being cuddly.
- **Hanken Grotesk** (400 / 500 / 600) — all prose, rules, rows, chips.
- **IBM Plex Mono** (400) — **only** data quoted from a rulebook: provenance stamps, dates,
  hex codes, section eyebrows. Uppercase, tracked out, 10–12px. Body copy is never mono.

Use the `TYPE` presets in `theme.ts` (`TYPE.answer`, `TYPE.h2`, `TYPE.row`, `TYPE.micro`, …)
rather than composing sizes by hand — they carry the tracking pre-multiplied.

## Layout & shape

Left-aligned, flush-left, whitespace on the right. **Over-rounded**: rows and notes 18,
cards 24, the answer card 28, sheets 34, every button and chip a full pill. Never a sharp
corner. Content stacks in one column with 18–20 gaps; a screen's primary action pins to the
bottom with the rulebook stamp under it.

**Elevation.** One soft warm shadow, reserved for things that represent a device screen or a
modal (the result sheet, the report sheet). Everything else is separated by a 1px `line`
(16% ink) or `lineStrong` (26%) — inputs and secondary buttons take the strong line, dashed
for "use my location". No inner shadows, no glows, no blur.

## The lid motif

A bin is drawn as a rounded vertical bar in its lid colour (`<Lid bin={…} />`); a row of them
describes a region's bin set (`<LidStack bins={…} />`). **This is the only illustration in the
system** — no bin drawings, no icons of trash, no mascots. It leads every item row, the
location chip, and the guide row under an answer.

## Icons

Lucide shapes at stroke 2.4, 14–20px, `currentColor`, in `src/ui/Icons.tsx`. Only functional
glyphs: search, camera, chevrons, close, plus, check, info, external, locate. No filled
icons, no icon fonts, no emoji.

## Components

- **Buttons** (`Button.tsx`): `primary` = accent fill / `onAccent` text; `secondary` =
  transparent with a `lineStrong` hairline; `ghost` = bare `accentStrong` text. Pressed moves
  one step along the ramp (`accentStrong`, `surface`, `accentTint` respectively). Disabled is
  45% opacity. Labels are Bricolage 600.
- **The answer card** (`ResultView.tsx`): the bin's `fill` with its `ink`, "Goes in" in mono
  micro at 80% opacity, the bin name in `TYPE.answer`, a 22%-white chip for the place.
- **Item rows**: lid · name (Hanken 500 / 15) · bin name (Bricolage 600 / 13 in `tintInk`).
- **The location chip** (`LocationChip.tsx`): a `surface` pill with a green lid, the place's
  name, a chevron. It sits in the header of every screen that gives an answer, because the
  place changes every answer below it.

## Voice

Calm, second-person, specific. Reassurance comes from naming the bin, not from tone.

- **Order is fixed: bin → reason → exception.**
- **Sentence case everywhere.** Uppercase only in mono stamps.
- **You, not we.**
- **Uncertainty is stated plainly** as a named condition, never hedged ("probably", "we think").
- **No exclamation marks, no emoji, no mascot, no puns on the name.**

Yes: *"Green bin. Greasy card can't be recycled here."*
No: *"Oops! That's a tricky one 🤔"*

## Explicitly excluded

- Gradients, photography, patterns (the viewfinder stripe is the one exception)
- Sharp corners; hairline-only geometric motifs
- Drawings or icons of bins/trash, mascots, illustrated characters
- Blur, frosted glass, inner shadows, glows
- Blue, black or amber anywhere that isn't a bin answer
- Bingo/game references (cards, grids, dabbers) despite the name
- Entrance animations, bounce, parallax — motion is 120–140ms colour/position only
