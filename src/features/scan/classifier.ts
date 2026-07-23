import type { TfliteModel } from "react-native-fast-tflite";

/**
 * Wiring for the on-device model.
 *
 * The model currently bundled (`assets/models/model.tflite`) is **EfficientDet Lite0**,
 * the standard pretrained COCO object detector — a stand-in "base model" per the PRD,
 * not the trained waste classifier. It takes a 320x320x3 uint8 image and returns the
 * classic TFLite detection quartet (boxes, classes, scores, count) over 90 COCO classes.
 *
 * COCO's classes ("bottle", "banana", "cell phone", …) aren't Bin-go's item keys, and the
 * real waste model doesn't exist yet, so for now every recognized object is surfaced as a
 * "consult local guide" result carrying the detected object's name (see `resolveScanResult`
 * in `regionData.ts`). When the transfer-learned model lands — whose output classes *are*
 * the item keys — the detection just feeds real keys and the fallback stops being hit.
 */

/** The model's square input dimension (EfficientDet Lite0 is 320x320). */
export const MODEL_INPUT_SIZE = 320;

/** Minimum detection score to surface a result. COCO detectors are noisy below this. */
export const SCORE_THRESHOLD = 0.4;

/**
 * In auto-scan (continuous) mode, a detection at or above this score commits on its own —
 * no tap. Set well above SCORE_THRESHOLD so the live label can show a detection homing in
 * (e.g. "Bottle · 62%") before it's confident enough to fire the result automatically.
 */
export const AUTO_SCAN_THRESHOLD = 0.65;

/**
 * Run inference only once every N delivered frames. The convert→resize→reorder→infer
 * pipeline is far heavier than one frame interval, so sampling it is what keeps the preview
 * smooth — this is the main lag knob. Lower = more responsive but heavier (more dropped
 * frames); higher = smoother but the detected item updates less often. At ~30fps, 15 frames
 * is ~2 inferences/sec. (Frame-count based rather than time based, so it self-throttles: if
 * the device delivers frames slower, inference automatically backs off with it.)
 */
export const INFERENCE_EVERY_N_FRAMES = 15;

/**
 * COCO 2017 label list, in class-index order — matches the `labelmap.txt` embedded in the
 * model's metadata (including the `???` reserved slots). The model returns class indices
 * into this array.
 */
export const COCO_LABELS: readonly string[] = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "???", "stop sign", "parking meter", "bench", "bird",
  "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "???",
  "backpack", "umbrella", "???", "???", "handbag", "tie", "suitcase", "frisbee", "skis",
  "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
  "surfboard", "tennis racket", "bottle", "???", "wine glass", "cup", "fork", "knife",
  "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli", "carrot",
  "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed", "???",
  "dining table", "???", "???", "toilet", "???", "tv", "laptop", "mouse", "remote",
  "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "???",
  "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
];

/** Reserved COCO slots have this label; they're not real objects, so detections hit them
 * are skipped. */
export const COCO_PLACEHOLDER = "???";

/**
 * The current best detection: the COCO object label and its score. There's no item key yet
 * because the base model's classes aren't item keys — the label is turned into a display
 * key at commit time (see `labelToItemKey`).
 */
export type Detection = {
  label: string;
  score: number;
};

/**
 * Turn a COCO label ("cell phone") into an item-key-shaped string ("cell_phone") so it
 * renders through `formatItemName` and stores as a history key. Once the real model lands
 * this goes away — its outputs are already item keys.
 */
export function labelToItemKey(label: string): string {
  return label.trim().toLowerCase().split(/\s+/).join("_");
}

/**
 * Which output tensor holds what. EfficientDet Lite0 emits four outputs but their index
 * order isn't guaranteed across exports, so we resolve them by shape once at load:
 * locations are the `[1, N, 4]` tensor, the count is the scalar `[1]` tensor, and the two
 * remaining `[1, N]` vectors are classes and scores. Classes-vs-scores can't be told apart
 * by shape (both `[1, N]`), so we keep both indices and disambiguate by value at runtime
 * (scores are probabilities in [0, 1]; class indices are not).
 */
export type OutputLayout = {
  locations: number;
  count: number;
  vectorA: number;
  vectorB: number;
};

export function resolveOutputLayout(model: TfliteModel): OutputLayout {
  const layout: OutputLayout = { locations: 0, count: 3, vectorA: 1, vectorB: 2 };
  const vectors: number[] = [];

  model.outputs.forEach((tensor, index) => {
    const shape = tensor.shape;
    const total = shape.reduce((a, b) => a * b, 1);
    if (shape.length >= 2 && shape[shape.length - 1] === 4) {
      layout.locations = index;
    } else if (total === 1) {
      layout.count = index;
    } else {
      vectors.push(index);
    }
  });

  if (vectors.length === 2) {
    layout.vectorA = vectors[0];
    layout.vectorB = vectors[1];
  }
  return layout;
}
