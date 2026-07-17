# ♻️ Bin-go

Bin-go is a waste-sorting app for your phone. Point your camera at something you're about to throw
away, and Bin-go tells you which bin it actually belongs in — recycling 🔵, compost 🟢, garbage ⚫,
or "check your local guide" 📋 for the tricky stuff like batteries and electronics.

No more guessing at the recycling symbol, no more googling "is a greasy pizza box recyclable." 🍕

## 🤔 Why

Sorting rules aren't universal — what's recyclable in one city might be garbage in the next, and
compost programs vary even more. Bin-go builds that local knowledge into the app itself, so the
answer you get is right for where you live, not a generic rule of thumb.

## ✨ Features

- 📸 **Scan to sort** — open the app, point at an item, tap to scan. Bin-go identifies it and shows
  the correct bin in a clean result card, with notes for anything that needs special handling.
- 📍 **Region-aware rules** — disposal rules are matched to your area, since garbage and compost
  handling can differ block to block even when recycling doesn't.
- 🕒 **Scan history** — every scan is logged on your device and kept between launches, so you can
  look back at what you sorted and where it went.
- 🌗 **Light & dark themes** — the whole app adapts to your system appearance.
- 🧭 **Simple, focused flow** — three tabs: Scan, History, and Settings. No clutter, no accounts to
  set up.

Currently live for **Toronto, Ontario, Canada** 🇨🇦, covering common household items (bottles,
containers, paper, batteries, and more).

## 🚧 Coming soon

- 🧠 **Real on-device recognition** — the camera scan currently demos the result flow; on-device ML
  item recognition is next, so it works fully offline with nothing sent off your phone.
- 📊 **Sorting stats** — your history list is live today; a breakdown of your
  recycling/compost/garbage split is still to come.
- 🗺️ **Automatic region detection** — Bin-go will detect your location and load the right region's
  rules automatically, with manual selection as a fallback.
- 💾 **Saved settings** — your region and theme preferences will persist between sessions.
- 🌍 **More regions** — expanding coverage beyond Toronto over time.
- 🚩 **"Report incorrect sort"** — flag a wrong result directly from the scan card.

## 🚀 Try it

Bin-go is an early-stage Expo (React Native) app, currently run as a local development build on
iOS and Android — it's not yet available on the App Store or Play Store.

```bash
npm install
npx expo start
```

Expo Go isn't compatible with this project's SDK version, so running on a physical device or
simulator needs a local dev build.

The current build punch list is in [TODO.md](TODO.md).
