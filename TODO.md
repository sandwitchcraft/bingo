# TODO

Running punch list. Check things off as they land; add new items as they come up.

## Data
- [ ] Create `assets/data/canada/ontario/ontario.json` — province-wide fallback (recycling rules
      are standardized across Ontario as of 2026; Toronto stays a full standalone file since
      garbage/compost still varies by city)
- [ ] Wire up "most specific wins" region lookup (city → province → country) once more than one
      region file exists — right now `regionData.ts` just imports `toronto.json` directly

## Scan flow
- [ ] Replace the faked detected item (`"plastic_bottle"` hardcoded in `(tabs)/index.tsx`) with
      real on-device ML (TensorFlow Lite / Core ML transfer-learning model)
- [ ] Wire the "Report incorrect sort" row in `ScanResultSheet` — currently a no-op placeholder

## Screens (currently stubs)
- [ ] History screen: real data (see Storage below) — list + 3-bin stats grid per the UI spec
- [ ] Settings screen: location detection button, region picker modal, preference toggles,
      support/about sections — only the Dark/Light theme toggle is wired up so far

## Storage
- [ ] SQLite scan history logging (`expo-sqlite`) — schema already documented in CLAUDE.md
- [ ] AsyncStorage settings/preferences (selected region, units, theme — theme currently resets
      to dark on every app launch since it's just component state)

## Location / region detection
- [ ] Reverse geocoding (Nominatim) to resolve GPS lat/long → region name
- [ ] Manual region picker fallback for offline/denied-permission cases

## Dev environment
- [x] Expo Go doesn't support this project's SDK version, so local device testing needs a real
      dev build. `scripts/ios-dev-build.sh` walks through it end to end (CocoaPods, device
      detection, build/install, common-failure remediation, starts Metro at the end).
- [ ] `npm run reset-project` is broken — `scripts/reset-project.js` doesn't exist. Either restore
      the script or drop it from `package.json`.

## Later / stretch (per PRD)
- [ ] Region coverage beyond Ontario
- [ ] Multi-item detection per frame
- [ ] Offline point-in-polygon geocoding (removes the online reverse-geocoding dependency)
