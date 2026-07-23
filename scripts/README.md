# `scripts/` — local developer tooling

Not part of the app bundle. These are convenience wrappers for things that are awkward to
do by hand; nothing here runs in CI.

```
ios-dev-build.sh   interactive iOS build wizard — builds and installs on a physical
                   iPhone. Needed because this project's Expo SDK is newer than Expo Go
                   supports, so `npx expo run:ios` via Expo Go isn't an option. Offers a
                   development (Metro-served JS) and a standalone mode, and gives targeted
                   fixes for the usual first-run failures: missing CocoaPods, low disk,
                   Developer Mode off, unconfigured signing, untrusted developer profile.
                   Gitignored — local to this machine.
```

## Note on `npm run reset-project`

`package.json` still declares a `reset-project` script pointing at `scripts/reset-project.js`,
which does not exist — it came from the `create-expo-app` template and the file was removed.
Running it fails. Tracked in [docs/product/TODO.md](../docs/product/TODO.md); left as-is here
rather than fixed silently, since the call is whether to restore the script or drop the entry.
