# `features/search` — look an item up by name

The manual counterpart to the camera: type an item, get its bin. Useful on its own, and the
fallback whenever a scan can't name the item.

```
searchItems.ts   pure text search over one region's items (React-free)
```

- **`searchItems(rules, query)`** takes the active `RegionRules` explicitly (same convention
  as `features/region/regionData.ts` and the scan helpers) and returns ranked `ItemHit`s.
  Empty query → the whole catalog, alphabetical. Normalization strips `-`, `_` and parens so
  kebab-case keys like `plant-pot-(plastic)` are typeable.

The screen is the route `src/app/(tabs)/search.tsx`; selecting a result pushes the
full-screen `src/app/item.tsx` window. Both read the active region from
`features/region/regionStore`, render item artwork with `features/scan/ItemIcons`, and
resolve the bin outcome with `resolveScanResult` from `features/region/regionData` — the
same call the scan result sheet makes.
