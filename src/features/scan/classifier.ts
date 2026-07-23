import type { TfliteModel } from "react-native-fast-tflite";

import { IMAGENET_LABELS } from "@/features/scan/imagenetLabels";

/**
 * Wiring for the on-device model.
 *
 * The model currently bundled (`assets/models/efficientnet-lite0-int8.tflite`) is
 * **EfficientNet-Lite0**, the standard pretrained ImageNet-1k classifier, quantized to bytes —
 * still a stand-in "base model" per the PRD, not a trained waste classifier. It takes a
 * 224x224x3 byte image and returns one `[1, 1000]` vector of class scores.
 *
 * Unlike the COCO detector this replaced, ImageNet's vocabulary genuinely overlaps bingoDB's
 * item keys: "pop bottle", "water bottle", "beer bottle", "wine bottle", "coffee mug",
 * "carton" and "Granny Smith" all map to keys the region files publish (see
 * `LABEL_TO_ITEM_KEY`), so common scans now produce real bin results instead of every scan
 * falling through to check-local-guide.
 *
 * What it still can't do: ImageNet has no notion of *material*. Nothing distinguishes a
 * styrofoam cup from a paper one, and there is no class for a takeout container or a
 * disposable battery — so `styrofoam-cup`, `styrofoam-takeout-container`,
 * `cardboard-takeout-container` and `disposable-batteries` keep hitting the fallback until a
 * trained model lands. Anything unmapped still surfaces as a check-local-guide result carrying
 * the ImageNet label (`resolveScanResult` in `regionData.ts`), which beats "unknown object".
 */

/** The model's square input dimension (EfficientNet-Lite0 is 224x224). */
export const MODEL_INPUT_SIZE = 224;

/**
 * Minimum top-1 score to surface a result. Lower than the detector's 0.4 on purpose: a softmax
 * over 1000 classes spreads its mass far wider than a detector's per-box confidence, and
 * neighbouring ImageNet classes ("pop bottle"/"water bottle") split the vote between them.
 */
export const SCORE_THRESHOLD = 0.25;

/**
 * In auto-scan (continuous) mode, a detection at or above this score commits on its own —
 * no tap. Set well above SCORE_THRESHOLD so the live label can show a classification homing in
 * (e.g. "Water Bottle · 31%") before it's confident enough to fire the result automatically.
 */
export const AUTO_SCAN_THRESHOLD = 0.45;

/**
 * Run inference only once every N delivered frames. The convert→crop→resize→reorder→infer
 * pipeline is heavier than one frame interval, so sampling it is what keeps the preview
 * smooth — this is the main lag knob. Lower = more responsive but heavier (more dropped
 * frames); higher = smoother but the detected item updates less often. At ~30fps, 10 frames
 * is ~3 inferences/sec; 224x224 classification is cheaper than the 320x320 detection this
 * replaced, which is where the headroom for the lower number came from. (Frame-count based
 * rather than time based, so it self-throttles: if the device delivers frames slower,
 * inference automatically backs off with it.)
 */
export const INFERENCE_EVERY_N_FRAMES = 10;

/**
 * ImageNet-1k label → bingoDB item key.
 *
 * Only labels that map onto a key some region file actually publishes belong here; everything
 * else falls through to the check-local-guide result carrying its ImageNet name.
 *
 * Keys are the **verbatim** label strings from `imagenetLabels.ts`, capitalization and spacing
 * included ("Granny Smith") — the lookup is exact, so a normalized key would silently miss.
 *
 * "cup" → `paper-cup` is a knowingly lossy call: ImageNet's "cup" is usually ceramic, but no
 * region publishes a reusable-mug key and `paper-cup` is the nearest real answer. Same for
 * "crate"/"packet" → `cardboard-box`.
 */
export const LABEL_TO_ITEM_KEY: Readonly<Record<string, string>> = {
  "pop bottle": "plastic-bottle",
  "water bottle": "plastic-bottle",
  "pill bottle": "plastic-bottle",
  "beer bottle": "glass-bottle",
  "wine bottle": "glass-bottle",
  "coffee mug": "paper-cup",
  cup: "paper-cup",
  carton: "cardboard-box",
  packet: "cardboard-box",
  crate: "cardboard-box",
  "Granny Smith": "apple-core",
};

/**
 * The current best classification: the ImageNet label and its score. There's no item key yet
 * because most of the model's classes aren't item keys — the label is turned into a key at
 * commit time (see `labelToItemKey`).
 */
export type Detection = {
  label: string;
  score: number;
};

/**
 * Turn a model label into an item key. Mapped labels become the region's real kebab-case key
 * ("water bottle" → "plastic-bottle"); everything else falls back to an item-key-shaped
 * snake_case string ("cell phone" → "cell_phone") so it still renders through `formatItemName`
 * and stores as a history key. `formatItemName` splits on both separators, so the two shapes
 * coexist in history without a migration.
 */
export function labelToItemKey(label: string): string {
  return LABEL_TO_ITEM_KEY[label] ?? label.trim().toLowerCase().split(/\s+/).join("_");
}

/**
 * How to read this particular model's tensors. Resolved once at load on the JS thread and
 * captured into the frame worklet as plain values.
 *
 * All three fields exist so a model swap doesn't silently produce plausible-but-wrong labels,
 * which is the failure mode here — a quantized tensor read as float32 yields garbage that
 * looks like a broken model rather than a typed-array bug.
 */
export type ModelIO = {
  /** Input is signed int8 rather than uint8, so the 0–255 bytes need a -128 shift. */
  inputSigned: boolean;
  /** Output is float32 rather than a quantized byte vector (scores are already 0–1). */
  outputFloat: boolean;
  /**
   * Output is signed int8. Matters for more than presentation: read as unsigned, a negative
   * quantized score becomes a large positive one and argmax picks whichever class the model
   * was *least* confident about — a wrong label, not a visible failure.
   */
  outputSigned: boolean;
  /** Leading classes to skip: 1 for a model with a background class at index 0, else 0. */
  labelOffset: number;
};

export function resolveModelIO(model: TfliteModel): ModelIO {
  const input = model.inputs[0];
  const output = model.outputs[0];
  const outputSize = output ? output.shape.reduce((a, b) => a * b, 1) : IMAGENET_LABELS.length;
  return {
    inputSigned: input?.dataType === "int8",
    outputFloat: output?.dataType === "float32" || output?.dataType === "float16",
    outputSigned: output?.dataType === "int8",
    labelOffset: Math.max(0, outputSize - IMAGENET_LABELS.length),
  };
}
