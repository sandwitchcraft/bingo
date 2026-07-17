# TODO

Running punch list. Check things off as they land; add new items as they come up.

## Data
- [ ] Create `assets/data/canada/ontario/ontario.json` — province-wide fallback (recycling rules
      are standardized across Ontario as of 2026; Toronto stays a full standalone file since
      garbage/compost still varies by city)
- [ ] Wire up "most specific wins" region lookup (city → province → country) once more than one
      region file exists — right now `regionData.ts` just imports `toronto.json` directly

## Scan flow
- [ ] Replace the faked detected item (`getRandomItemKey()`, called from `(tabs)/index.tsx`) with
      real on-device ML (TensorFlow Lite / Core ML transfer-learning model). Note this now writes
      random items into scan history on every scan — Settings → Clear sort history flushes them.
- [ ] Wire the "Report incorrect sort" row in `ScanResultSheet` — currently a no-op placeholder

## Screens (currently stubs)
- [ ] History screen: reads real data now (plain list of scans), but still needs the designed
      list rows + 3-bin stats grid per the UI spec. `useScanHistory` already returns the
      per-bin `counts` the grid needs.
- [ ] Settings screen: location detection button, region picker modal, preference toggles,
      support/about sections — only the Dark/Light theme toggle is wired up so far

## Storage
- [x] SQLite scan history logging (`expo-sqlite`) — `src/lib/db.ts` owns the schema, a
      `user_version` migration and the queries; scans are written from `showResult` in
      `scanResult.tsx`, and `useScanHistory` reads them back on screen focus
- [ ] `SQLiteProvider` has no `onError` handler, so a failed database open throws. Setting one
      would render the whole app null forever instead, so this needs a real error boundary +
      retry UI, not just a callback.
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
