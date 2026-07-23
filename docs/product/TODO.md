# TODO

Running punch list. Check things off as they land; add new items as they come up.

## Data
- [x] Rules now come from bingoDB (`https://sandwitchcraft.github.io/bingoDB/`) rather than a
      bundled file — `regionSource.ts` fetches/validates/caches, `regionStore.tsx` holds the
      active region, `assets/data/.../toronto/toronto.json` is an offline snapshot only
- [x] `index.json` published at the bingoDB root — region discovery works end to end
- [ ] Teach `csv_to_json.py` to regenerate `index.json` — it's hand-copied right now, so adding a
      region to the DB silently leaves it undiscoverable. The contract is the published
      `index.json` in the bingoDB repo, and `parseRegionIndex` in `regionSource.ts` is what
      consumes it: a flat leaf-files-only list, sorted by parents then display_name.
- [ ] Add an Ontario province-wide file to bingoDB (recycling rules are standardized across
      Ontario as of 2026; Toronto stays a full standalone file since garbage/organics still varies
      by city)
- [ ] Wire up "most specific wins" region lookup (city → province → country) once province-level
      files exist — selection is currently one flat pick from the index, no fallback chain

## Scan flow
- [x] Real on-device ML replaced the faked detected item — vision-camera frame processor +
      react-native-fast-tflite
- [ ] Train/ship the real waste classifier. The bundled model is still COCO EfficientDet Lite0,
      whose labels aren't item keys, so every live scan resolves to the check-local-guide
      fallback and no region rule is ever exercised. Until then, Settings → **Sort a random
      item** (dev-only) sorts a random key from the active region's rules — that's what
      verifies the region data is wired. It writes a history row like any scan; Settings →
      Clear sort history flushes them.
      When swapping the trained model in, three things beyond the `require()` need attention:
      its class order has to be written down app-side (there's no labelmap in the .tflite, and
      a reorder silently names the wrong item); its input normalization has to match training
      (0–1 for TF-Hub modules, [-1,1] for Keras `preprocess_input`); and its class names have
      to be reconciled with bingoDB's item keys, which are close but not identical.
- [ ] Drop `getRandomItemKey` and the "Sort a random item" row once the real model lands. It is
      no longer dev-gated: on a release/TestFlight build it's the only way to see a real bin
      result, since the COCO model can't produce item keys.
- [ ] Wire the "Report incorrect sort" row in `ScanResultSheet` — currently a no-op placeholder

## Screens (currently stubs)
- [ ] History screen: reads real data now (plain list of scans), but still needs the designed
      list rows + 3-bin stats grid per the UI spec. `useScanHistory` already returns the
      per-bin `counts` the grid needs.
- [ ] Settings screen: preference toggles, support/about sections — theme, scan mode, region,
      location detection and clear-history are wired so far. The screen scrolls now.

- [ ] The rules refresh on launch goes through the platform HTTP cache, so a bingoDB
      correction can be up to 10 minutes invisible (GitHub Pages sends `max-age=600`).
      Settings → **Check for rule updates** bypasses it via a cache-busting query param;
      decide whether the launch path should too, or whether 10 minutes is fine in production.

## Errors / notifications
- [x] In-app error banner — `ToastProvider` (`src/ui/toast.tsx`) + `ErrorToast`
      (`src/ui/ErrorToast.tsx`), mounted at the root. Red, drops in from the top,
      auto-dismisses after 5s. Raise one with `useToast().showError(message)`.
- [ ] Move the failures that currently go through `Alert.alert` (`dialogs.ts` → `notify`) onto
      the toast where they're a report rather than a question: the clear-history and seed
      failure notices both qualify. Confirmations stay dialogs.

## Storage
- [x] SQLite scan history logging (`expo-sqlite`) — `src/features/history/db.ts` owns the schema, a
      `user_version` migration and the queries; scans are written from `showResult` in
      `scanResult.tsx`, and `useScanHistory` reads them back on screen focus
- [ ] `SQLiteProvider` has no `onError` handler, so a failed database open throws. Setting one
      would render the whole app null forever instead, so this needs a real error boundary +
      retry UI, not just a callback.
- [x] AsyncStorage wrapper (`src/core/storage.ts`) + persisted region selection and cached region
      rules/index
- [ ] Persist the rest through `storage.ts`: theme preference and scan mode both still reset on
      every launch since they're just component state

## Location / region detection
- [x] Manual region picker — Settings → Region opens `src/app/region.tsx` (full-screen, search,
      slide-in from the right), persists the choice, works offline off the cache
- [x] Per-region downloads — cloud icon downloads without selecting, stop button appears only
      if the transfer passes 1s, swipe-to-delete removes, `DOWNLOADED` section sorts first.
      Selecting a downloaded region is now cache-only, so switching regions works offline.
- [ ] `refreshDownloadedRules` walks downloaded regions sequentially. Fine at today's catalog
      size; if downloads ever reach dozens, it needs throttling or a staleness check
      (`last_updated`) so a refresh isn't N full fetches every time.
- [x] Reverse geocoding (Nominatim) — Settings → Location → **Detect** reads the GPS fix,
      reverse-geocodes it (`src/features/region/location.ts`), matches the result against the catalog
      most-specific-first, and selects it. The manual picker stays the fallback; every
      failure mode surfaces as one sentence in the error toast.
- [ ] `expo-location` was added to `app.json`'s plugins for its permission strings — this needs
      a native rebuild (`scripts/ios-dev-build.sh`) before Detect will work on device.
- [ ] Detection matches only the leaf name (city, then county, then state). Once province-level
      files exist it should fall back down the chain rather than giving up at "no-match".

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
