# `scripts/` — local developer tooling

Not part of the app bundle. These are convenience wrappers for things that are awkward to
do by hand; nothing here runs in CI.

```
ios-dev-build.sh   interactive iOS build wizard — builds and installs on a physical
                   iPhone or an Xcode simulator. Needed because this project's Expo SDK
                   is newer than Expo Go supports, so `npx expo run:ios` via Expo Go
                   isn't an option. Offers a development (Metro-served JS) and a
                   standalone mode, and gives targeted fixes for the usual first-run
                   failures: missing CocoaPods, low disk, Developer Mode off,
                   unconfigured signing, untrusted developer profile.
                   Gitignored — local to this machine.
```

Two independent choices, asked at startup or forced with flags — `--dev`/`--release` for
how the JS gets in, `--device`/`--simulator [name]` for where it runs:

```
./scripts/ios-dev-build.sh                          # ask both
./scripts/ios-dev-build.sh --simulator --dev        # iPhone 17 sim, Metro-served
./scripts/ios-dev-build.sh -s "iPad Air 11-inch (M4)" -r
```

**The simulator has no camera**, so `useCameraDevice("back")` in `src/app/(tabs)/index.tsx`
never resolves and the Scan tab sits on "Loading camera…" indefinitely. That's the whole
reason the physical device stays the default: History, Settings and the region picker are
what the simulator is good for. The simulator path skips signing, Developer Mode, the trust
prompt and the local-network prompt (it reaches Metro over localhost), which is what makes
it the faster loop for everything that isn't scanning.

## Note on `npm run reset-project`

`package.json` still declares a `reset-project` script pointing at `scripts/reset-project.js`,
which does not exist — it came from the `create-expo-app` template and the file was removed.
Running it fails. Tracked in [docs/product/TODO.md](../docs/product/TODO.md); left as-is here
rather than fixed silently, since the call is whether to restore the script or drop the entry.
