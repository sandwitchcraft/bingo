# `src/` — application source

Organized by **feature**, not by kind. A feature folder owns everything about its slice of
the app: its remote/local data access, its React state provider, and its own components.
Anything two features both need moves down into `core/` or `ui/`.

Every module is imported through the `@/*` alias (`tsconfig.json` maps it to `src/*`).
There are no relative cross-folder imports — keep it that way, so a future move stays a
find-and-replace.

```
app/                 expo-router routes. The file tree IS the navigation graph.
  _layout.tsx          root: fonts, theme state, provider stack, global overlays
  add-place.tsx        add/edit a place: label + region catalog (pushed from the Location tab)
  item.tsx             full-screen item result (pushed from Search, not a tab)
  (tabs)/              the five-tab shell: region=Location home, history, index=Scan, search, settings

features/
  region/            which rules are in use, and where they came from
    regionSource.ts    URLs, schema parsing/validation, AsyncStorage cache, bundled fallback
    regionStore.tsx    RegionProvider — the active region, downloads, refresh
    placesStore.tsx    PlacesProvider — saved places ("Home", "Work") pinned to regions
    PlacesSheet.tsx    the places dropdown (bottom sheet) raised from the location chip
    regionData.ts      pure lookups over one region's rules
    location.ts        GPS → reverse geocode → catalog match
    regionInfo.ts      per-region notices + plastic-code verdicts, read from the active rules
    LocationChip.tsx   the header pill showing the active place; opens PlacesSheet

  search/            look an item up by name (the manual counterpart to scan)
    searchItems.ts     pure ranked text search over one region's items

  scan/              camera → model → result
    classifier.ts      model I/O: tensor dtypes, thresholds, label → item-key mapping
    imagenetLabels.ts  the bundled model's 1000 class labels, in index order
    scanResult.tsx     ScanResultProvider — the active result, and the history write
    scanSettings.tsx   continuous vs tap scan mode
    ScanResultSheet.tsx  the draggable result sheet (mounted globally)
    ItemIcons.tsx      per-item artwork and the bin-tinted badge

  history/           what was scanned, persisted
    db.ts              SQLite schema, migrations, queries
    useScanHistory.ts  the read hook (refetches on screen focus)
    devSeed.ts         dev-only backdated rows for testing date rendering

ui/                  the design system and app-wide chrome
  brand.ts             raw design-sheet tokens; mirrors docs/design/branding/theme.ts
  theme.ts             semantic light/dark Theme (incl. per-bin swatches) + TYPE scale — the
                       single import site for components
  Button.tsx           the three pills: primary / secondary / ghost
  Lid.tsx              the lid-bar motif (Lid, LidStack) — the system's only illustration
  Icons.tsx            functional glyphs (search, camera, chevrons, close, check, info, …)
  toast.tsx            error-banner state
  ErrorToast.tsx       error-banner rendering
  dialogs.ts           Alert wrappers (react-native-web's Alert is a silent no-op)
  Wordmark.tsx         the bin·go wordmark, so the brand rule lives in one place
  TabIcons.tsx         bottom-nav glyphs

core/                feature-agnostic primitives, no React
  net.ts               the one fetch wrapper (RN fetch has no timeout of its own)
  storage.ts           typed JSON wrapper over AsyncStorage + the key namespace
  bins.ts              the bin vocabulary, defined by bingoDB — types and labels (colour is on the Theme)
```

## Rules of thumb

- **`core/` imports nothing from `features/` or `ui/`.** `ui/` imports `core/`. Features
  import both. Routes import features. Dependencies point downward only.
- **`bins.ts` is in `core/`, not `features/scan/`,** because all three features speak it —
  scan produces a bin, history stores one, region rules define them.
- **`regionData.ts` takes `RegionRules` as its first argument** rather than importing the
  active region. The active region changes at runtime, so it lives in React state; keeping
  the lookups pure is what lets them be tested and reused off the render path.
- **No ESLint here, deliberately** — see `CLAUDE.md`. `npx tsc --noEmit` is the static check.
