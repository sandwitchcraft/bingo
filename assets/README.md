# `assets/` — bundled binary and data assets

Everything here is compiled into the app binary. Imported through the `@/assets/*` alias
(`tsconfig.json`), and both non-standard extensions below are registered in
`metro.config.js` — Metro won't bundle a `.tflite` or resolve a `.wasm` without that.

```
data/                 offline fallback copies of bingoDB files
  items.json                        the global item registry (names, keywords, materials)
  canada/ontario/toronto/toronto.json
models/
  efficientnet-lite0-int8.tflite   the on-device classifier (bundled)
```

## `data/` — why the deep folder path

The nesting is **not** organizational: it mirrors bingoDB's published layout exactly
(`items.json` at the root, `<country>/<province>/<region>/<region>.json` below), so a
bundled file and a fetched one are addressed the same way. Do not flatten it.

Both files are **verbatim snapshots of the live files**, not separately maintained copies.
Rules and names come from bingoDB at runtime; these exist only so a first launch with no
network is still useful. They are parsed by `parseRegionRules` / `parseItemRegistry` like
anything fetched — there is deliberately no second schema in the codebase. They travel
together: the region file stopped carrying `display_name` for registry keys, so a bundled
Toronto without the bundled registry would show title-cased slugs.

## `models/efficientnet-lite0-int8.tflite` — the bundled model

**A stand-in, not the real thing.** EfficientNet-Lite0 trained on ImageNet-1k and quantized
to bytes (224x224 in, one `[1, 1000]` score vector out) — not the transfer-learned waste
classifier the PRD calls for. Downloaded from Google's MediaPipe model bucket:

```
https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/int8/1/efficientnet_lite0.tflite
```

Unlike the COCO detector it replaced (2026-07-23), ImageNet's vocabulary genuinely overlaps
the region item keys — "pop bottle", "beer bottle", "coffee mug", "carton", "Granny Smith"
and friends map to real keys via `LABEL_TO_ITEM_KEY` in `src/features/scan/classifier.ts`,
so common scans produce real bin results. Material distinctions (styrofoam vs paper) and
batteries are still beyond it and fall through to "check local guide".

The label list lives in `src/features/scan/imagenetLabels.ts`, extracted verbatim from the
`labels_without_background.txt` file embedded in this model's own TFLite metadata (`unzip -o`
the `.tflite` to re-extract it). It's a TS array rather than a bundled `.txt` because the
frame worklet reads it on the frame thread, where nothing can be awaited.
