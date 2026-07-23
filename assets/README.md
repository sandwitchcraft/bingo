# `assets/` — bundled binary and data assets

Everything here is compiled into the app binary. Imported through the `@/assets/*` alias
(`tsconfig.json`), and both non-standard extensions below are registered in
`metro.config.js` — Metro won't bundle a `.tflite` or resolve a `.wasm` without that.

```
data/                 offline fallback copies of region rules
  canada/ontario/toronto/toronto.json
models/
  model.tflite        the on-device classifier (bundled)
  modelV2.tflite      the trained waste classifier — present but NOT wired up
```

## `data/` — why the deep folder path

The nesting is **not** organizational: it mirrors bingoDB's published layout exactly
(`<country>/<province>/<region>/<region>.json`), so a bundled file and a fetched one are
addressed the same way. Do not flatten it.

`toronto.json` is a **verbatim snapshot of the live file**, not a separately maintained
copy. Rules come from bingoDB at runtime; this exists only so a first launch with no
network is still useful. It is parsed by `parseRegionRules` like anything fetched —
there is deliberately no second schema in the codebase.

## `models/model.tflite` — the bundled model

**A stand-in, not the real thing.** It's EfficientDet Lite0, the pretrained COCO object
detector (320x320 uint8 in; boxes/classes/scores/count out) — not the transfer-learned
waste classifier the PRD calls for. Because COCO's classes aren't the region's item keys,
every detection currently resolves to a "check local guide" result. See
`src/features/scan/classifier.ts`.

It stays wired up deliberately: it's a known-good load for exercising the on-device
inference path (frame → resize → uint8 RGB → `runSync` → parse) independently of whether
the trained model is ready.

## `models/modelV2.tflite` — not wired up

The MobileNetV2 224 waste classifier. Present in the repo but nothing requires it — the
scan screen still loads `model.tflite`. Switching to it is not a one-line change: it's a
classifier, not a detector, so it needs float32 0–1 input at 224x224, argmax over a single
`[1, N]` output instead of the detection-quartet parsing, a written-down class order (no
labelmap in the metadata), and a reconciliation between its class names and bingoDB's item
keys — `battery-disposable` vs `disposable-batteries`, `styrofoam-container` vs
`styrofoam-takeout-container`, and `aluminum-can`/`paper-printer`, which no region lists.
