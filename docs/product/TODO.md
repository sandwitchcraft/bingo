# TODO

Running punch list. Check things off as they land; add new items as they come up.

## Known Bugs
- [x] 'notes' feature on the item reporting tool has weird keyboard effect. Fixed: the
      `ReportSheet` was owned by both a `KeyboardAvoidingView` (`padding`) and its own
      Reanimated `translateY` — two owners of the sheet's position that fought on every
      re-layout while typing. Dropped the KAV. The sheet now stays **anchored** at the bottom
      (not lifted) so the scrim stays tappable and the grabber swipeable to exit mid-edit; the
      form `ScrollView` uses iOS `automaticallyAdjustKeyboardInsets` to scroll the focused
      Notes box above the keyboard.
- [x] Search: tapping a result while the keyboard was up left the keyboard's QuickType/accessory
      strip stranded mid-screen for the length of the `item` slide animation. Fixed by
      `Keyboard.dismiss()` before the push in `search.tsx` `openItem`.

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
- [x] Replaced the COCO detector with an ImageNet-1k classifier (EfficientNet-Lite0), so common
      scans hit real item keys instead of every scan falling through to consult-local-guide
- [ ] Train/ship the real waste classifier. The bundled ImageNet model is still a stand-in: it
      has no notion of material, so `styrofoam-cup`, `styrofoam-takeout-container`,
      `cardboard-takeout-container` and `disposable-batteries` are unreachable from a scan —
      four of the nine published keys. Bottles, cups, cardboard and apples do resolve.
      When swapping the trained model in, three things beyond the `require()` need attention:
      its class order has to be written down app-side (a reorder silently names the wrong item —
      `imagenetLabels.ts` is the shape to follow); its input normalization has to match training
      (`resolveModelIO` already branches uint8/int8, but a float model needs a real normalize
      step added to the worklet); and its class names have to be reconciled with bingoDB's item
      keys — extend or replace `LABEL_TO_ITEM_KEY` rather than renaming anything DB-side.
- [ ] Revisit `getRandomItemKey` and the "Sort a random item" row. Less load-bearing now that
      the model can produce real item keys, but still the only way to exercise a key no
      ImageNet class maps to (the four above).
- [x] Wire the "Report incorrect sort" row — opens the root-mounted `ReportSheet` for both hosts
      (scan sheet and search result). Choice step (`wrong_bin` / `wrong_item`, scan-only) → form
      (corrected bin + notes) → success; submits to Supabase via `submitReport`. See **Backend**.

## Backend (Supabase)
- [x] Supabase client (`src/core/supabase.ts`) — publishable key + URL from `.env.local`
      (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY`, both gitignored), session
      persistence off. Connection + RLS + storage verified end to end (smoke test, 9/9).
- [x] `submitReport` / `submitTrainingImage` (`src/features/reports/reports.ts`) — insert-only
      against RLS policies. `region` is the full path (`canada/ontario/toronto`) via
      `getRegionPath`; `report_type` keeps `wrong_bin` vs `wrong_item` distinct; the note
      preserves the originally-shown bin. Training images carry **no** device/user id by policy.
- [x] "Report incorrect sort" flow wired to `submitReport` (see Scan flow).
- [ ] "Help improve Bin-go" training-image opt-in — **defaults OFF**, fire-and-forget upload of a
      compressed scan photo via `submitTrainingImage`. Blocked on a photo-capture path: the scan
      pipeline is frame-only and saves no image, so there's nothing to upload yet.
- [ ] Remove the `__DEV__` "Test backend report" button in Settings before release — it's a
      dev-only connectivity probe, not shipping UI.
- [ ] Anti-abuse for reports is unplanned (no device id on reports either). If spam becomes a
      problem, decide whether a hashed device id on `reports` (not `training_images`) is worth it.

## Screens (currently stubs)
- [ ] History screen: reads real data now (plain list of scans), but still needs the designed
      list rows + 3-bin stats grid per the UI spec. `useScanHistory` already returns the
      per-bin `counts` the grid needs.
- [ ] Settings screen: preference toggles, support/about sections — theme, scan mode, region,
      location detection and clear-history are wired so far. The screen scrolls now.

- [ ] The rules refresh on launch goes through the platform HTTP cache, so a bingoDB
      correction can be up to 10 minutes invisible (GitHub Pages sends `max-age=600`). The
      manual **Check for rule updates** button (which bypassed the cache) has been removed —
      the launch refresh is now the only path, and it records the last time it reached bingoDB
      to drive the 15-day stale-data toast (`RULES_CHECK_MAX_AGE_MS` in `regionStore.tsx`).
      Decide whether the launch path should force-bypass the cache too, or whether 10 minutes
      is fine in production.

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
      if the transfer passes 1s, swipe-to-delete removes, downloaded regions sort above the rest.
      Selecting a downloaded region is now cache-only, so switching regions works offline.
- [ ] `refreshDownloadedRules` walks downloaded regions sequentially. Fine at today's catalog
      size; if downloads ever reach dozens, it needs throttling or a staleness check
      (`last_updated`) so a refresh isn't N full fetches every time.
- [x] Reverse geocoding (Nominatim) — the **Detect my location** button at the top of the
      region picker (`src/app/region.tsx`) reads the GPS fix, reverse-geocodes it
      (`src/features/region/location.ts`), matches the result against the catalog
      most-specific-first, and selects it. The manual list right below it stays the fallback;
      every failure mode surfaces as one sentence in the error toast. (Moved out of Settings so
      it sits next to the list it feeds.)
- [ ] `expo-location` was added to `app.json`'s plugins for its permission strings — this needs
      a native rebuild (`scripts/ios-dev-build.sh`) before Detect will work on device.
- [ ] Detection matches only the leaf name (city, then county, then state). Once province-level
      files exist it should fall back down the chain rather than giving up at "no-match".
- [x] Favourites — the heart on each picker row floats it toward the top. Ordering only:
      independent of download and selection, so an un-downloaded region can be hearted and
      stays near the top. Persisted as an id list (`StorageKeys.favouriteRegionIds`), never
      pruned against the catalog so an offline launch's short list can't drop them.
- [x] Flat, headerless region list — one `FlatList` ranked by `tierOf`: active → favourites
      (downloaded first) → downloaded → the rest (commercial "serves your area" first).
      Replaced the Downloaded/Available/Favourites section headers, which restated what each
      row already shows.

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
