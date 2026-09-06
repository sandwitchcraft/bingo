/**
 * Scan tab — the camera screen, and the only place inference actually runs.
 *
 * A Vision Camera `useFrameOutput` worklet runs the TFLite model on the frame thread every
 * Nth frame (~3x/sec) and reports the best detection back to JS. In `continuous` mode a
 * confident detection commits itself; in `tap` mode the current live detection is committed
 * when the user taps. Either way "committing" means handing an item key to `showResult`,
 * which writes the history row and raises the result sheet.
 *
 * The knobs (thresholds, frame interval, label→key mapping, tensor dtypes) all live
 * in `@/features/scan/classifier` — this file is the camera, the worklet plumbing, and the
 * viewfinder chrome only.
 *
 * Native-only: there is no web frame-processor, so the screen renders a notice under
 * `Platform.OS === "web"`. Its chrome is fixed dark regardless of app theme, since it sits
 * over the camera feed.
 */
import { useIsFocused } from "expo-router";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  HybridFrameConverter,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type Constraint,
  type FrameDroppedReason,
} from "react-native-vision-camera";
import { scheduleOnRN } from "react-native-worklets";

import { LocationChip } from "@/features/region/LocationChip";
import {
  AUTO_SCAN_THRESHOLD,
  INFERENCE_EVERY_N_FRAMES,
  MODEL_INPUT_SIZE,
  SCORE_THRESHOLD,
  labelToItemKey,
  resolveModelIO,
  type Detection,
} from "@/features/scan/classifier";
import { IMAGENET_LABELS } from "@/features/scan/imagenetLabels";
import { useScanResult } from "@/features/scan/scanResult";
import { useScanSettings } from "@/features/scan/scanSettings";
import { Button } from "@/ui/Button";
import { Wordmark } from "@/ui/Wordmark";
import { radii, scanSurface, TYPE } from "@/ui/theme";

// The bundled base model (EfficientNet-Lite0, ImageNet-1k, byte-quantized) — see
// src/features/scan/classifier.ts for what it can and can't map onto region item keys.
// require() hands Metro a bundled-asset handle; `tflite` is registered as an asset extension
// in metro.config.js.
const MODEL_SOURCE = require("@/assets/models/efficientnet-lite0-int8.tflite");

// The scan screen is the one permanently dark surface in the product, in both themes — it
// sits over the camera feed, so it takes `scanSurface` (the dark-mode tokens) rather than the
// active theme. Its reticle, shutter and lid all read in the lifted dark-mode green.
const SCAN_BG = scanSurface.bg;

// Ask the camera pipeline for a small frame near the model's input size, so the per-frame
// CPU copy the FrameConverter does is over a small buffer rather than a full-res one. It's
// only a target (aspect ratio wins over exact dimensions), so the worklet still resizes to
// exactly MODEL_INPUT_SIZE before inference — there's no full-res JPEG capture to shrink
// anymore, which is why the old takePictureAsync latency-hedge (pictureSize/quality) is gone.
const FRAME_TARGET = { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } as const;

// Force a 30fps target. Without this the session is free to settle on a low or variable
// frame rate — a candidate cause of the choppy preview. Module-level so the reference is
// stable (useCamera stringifies constraints, but no reason to rebuild it each render).
const CAMERA_CONSTRAINTS: Constraint[] = [{ fps: 30 }];

// Vision Camera and fast-tflite are both native-only (expo-camera had a web implementation
// via HTMLVideoElement; these don't). Web is just a testing convenience here — Expo Go is
// out for this SDK, so the browser is the quick loop for the non-camera screens. This split
// keeps the native-only hooks (camera, frame output, model) out of the render path entirely
// on web: the wrapper returns a notice before NativeScanScreen — and its hooks — ever run.
export default function ScanScreen() {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, styles.centered, { padding: 24 }]}>
        <Text style={styles.permissionText}>
          Scanning needs the native camera. Open the app on a device to scan; History and
          Settings work here in the browser.
        </Text>
      </View>
    );
  }
  return <NativeScanScreen />;
}

function NativeScanScreen() {
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const { showResult, activeItemKey } = useScanResult();
  const { scanMode } = useScanSettings();
  const tapMode = scanMode === "tap";
  const [scanning, setScanning] = useState(false);

  // Auto-scan (continuous) commits on its own when confident. Two refs keep the frame-thread
  // callback stable while still reading fresh state: `autoArmed` prevents re-firing for the
  // same continuous sighting (re-arms once the confident detection clears), and
  // `resultActive` blocks auto-firing while a result sheet is already up.
  const autoArmedRef = useRef(true);
  const resultActiveRef = useRef(false);
  resultActiveRef.current = activeItemKey != null;
  // The tabs stay mounted when you navigate away. Rather than unmount the camera
  // (the old CameraView workaround), isActive drives the native session directly:
  // false on blur releases the capture session and the OS camera indicator on the
  // History/Settings tabs.
  const isFocused = useIsFocused();
  // A mounted Camera isn't a running one: the AVCaptureSession needs its first
  // preview frame before capture is meaningful. onPreviewStarted signals that;
  // gating the tap target on it preserves the old "not enough camera data" guard.
  const [previewReady, setPreviewReady] = useState(false);

  // Live model output — in continuous mode this is the current best detection, refreshed a
  // few times a second from the frame thread. In tap mode it stays null (inference only runs
  // on tap). The fps/dropped counters stay on in both modes as the throughput probe.
  const [detection, setDetection] = useState<Detection | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [dropped, setDropped] = useState(0);

  // Tap-to-scan trigger: bumping this on tap re-registers the frame worklet with a new
  // capture generation, which the worklet compares against the last one it serviced to run
  // exactly one inference. (Continuous mode already re-registers the worklet a few times a
  // second as `detection` updates, so this is the same mechanism, not a new risk.)
  const [captureGen, setCaptureGen] = useState(0);
  // Safety net: if a tap's frame is never serviced (stalled stream), clear "Scanning…".
  const scanTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const model = useTensorflowModel(MODEL_SOURCE, []);
  const loadedModel = model.state === "loaded" ? model.model : null;
  // Tensor dtypes and the label offset aren't guaranteed across model swaps, so resolve them
  // once at load. Plain values, captured into the worklet below.
  const modelIO = useMemo(() => (loadedModel ? resolveModelIO(loadedModel) : null), [loadedModel]);

  // Reading a quantized tensor as the wrong type produces confident-looking wrong labels
  // rather than an error, so trace the real contract once whenever the model file changes.
  useEffect(() => {
    if (__DEV__ && loadedModel) {
      console.log("[scan] model io", {
        inputs: loadedModel.inputs.map((t) => `${t.dataType}[${t.shape.join(",")}]`),
        outputs: loadedModel.outputs.map((t) => `${t.dataType}[${t.shape.join(",")}]`),
      });
    }
  }, [loadedModel]);

  const reportFps = useCallback((value: number) => setFps(value), []);
  const reportDropped = useCallback(
    (_reason: FrameDroppedReason) => setDropped((n) => n + 1),
    [],
  );
  // Continuous mode: update the live label, and auto-commit when a detection clears the
  // auto-scan threshold. The guards make this fire once per sighting rather than every frame.
  const reportDetection = useCallback(
    (next: Detection | null) => {
      setDetection(next);
      const confident = next != null && next.score >= AUTO_SCAN_THRESHOLD;
      if (!confident) {
        autoArmedRef.current = true; // re-arm once the confident detection goes away
        return;
      }
      if (!autoArmedRef.current || resultActiveRef.current) return;
      autoArmedRef.current = false;
      showResult(labelToItemKey(next.label));
    },
    [showResult],
  );
  // Tap mode: a serviced capture commits its result directly (there's no live label to
  // commit from). A null result means nothing cleared the threshold — just stop scanning.
  const reportTapResult = useCallback(
    (best: Detection | null) => {
      if (scanTimeout.current) {
        clearTimeout(scanTimeout.current);
        scanTimeout.current = null;
      }
      setScanning(false);
      if (best) showResult(labelToItemKey(best.label));
    },
    [showResult],
  );

  const frameOutput = useFrameOutput({
    targetResolution: FRAME_TARGET,
    pixelFormat: "rgb",
    enablePreviewSizedOutputBuffers: true,
    onFrame: (frame) => {
      "worklet";
      // Throughput probe: count every delivered frame, report fps once per second.
      const g = globalThis as unknown as {
        __scan?: {
          count: number;
          windowStart: number;
          frameIndex: number;
          servicedGen: number;
        };
      };
      // Wall clock, not frame.timestamp: on iOS the presentation timestamp is in seconds,
      // which broke the earlier nanosecond assumption (the 1s window never elapsed, so fps
      // stuck on "measuring…"). Date.now() is unit-safe and available in the worklet runtime.
      const nowMs = Date.now();
      const s =
        g.__scan ??
        (g.__scan = { count: 0, windowStart: nowMs, frameIndex: 0, servicedGen: captureGen });
      s.count += 1;
      s.frameIndex += 1;
      const elapsed = nowMs - s.windowStart;
      if (elapsed >= 1000) {
        scheduleOnRN(reportFps, Math.round((s.count * 1000) / elapsed));
        s.count = 0;
        s.windowStart = nowMs;
      }

      // Decide whether this frame runs inference. Tap mode: only when a new capture was
      // requested (captureGen changed since the last one serviced). Continuous mode: every
      // Nth frame — inference is much heavier than a frame interval, so sampling it is what
      // keeps the preview smooth (INFERENCE_EVERY_N_FRAMES is the lag knob in classifier.ts).
      const wantInference = tapMode
        ? captureGen !== s.servicedGen
        : s.frameIndex % INFERENCE_EVERY_N_FRAMES === 0;
      if (loadedModel == null || modelIO == null || !wantInference) {
        frame.dispose();
        return;
      }
      if (tapMode) s.servicedGen = captureGen;

      // Preprocess: frame → Image (one CPU copy) → centre square → exact size → byte RGB
      // [1,S,S,3]. EfficientNet-Lite0's quantized build takes raw bytes, so the only
      // normalization is the int8 shift below (skipped entirely for a uint8 input).
      const image = HybridFrameConverter.convertFrameToImage(frame);
      frame.dispose(); // done with the frame the instant its pixels are copied out
      // Centre-crop to the shorter edge before resizing. A detector localized its own object
      // so a squashed frame was tolerable; a whole-frame classifier sees the distortion, and
      // cropping also makes what the model reads match the on-screen reticle the user aims.
      const side = Math.min(image.width, image.height);
      const x0 = Math.floor((image.width - side) / 2);
      const y0 = Math.floor((image.height - side) / 2);
      const raw = image
        .crop(x0, y0, x0 + side, y0 + side)
        .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
        .toRawPixelData();
      const src = new Uint8Array(raw.buffer);
      const rgb = new Uint8Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
      const fmt = raw.pixelFormat; // 'BGRA' or 'ARGB' per OS endianness (see nitro-image)
      for (let p = 0, q = 0; q < rgb.length; p += 4, q += 3) {
        if (fmt === "BGRA" || fmt === "BGRX") {
          rgb[q] = src[p + 2];
          rgb[q + 1] = src[p + 1];
          rgb[q + 2] = src[p];
        } else if (fmt === "ARGB" || fmt === "XRGB") {
          rgb[q] = src[p + 1];
          rgb[q + 1] = src[p + 2];
          rgb[q + 2] = src[p + 3];
        } else {
          // RGBA / RGBX / RGB — first three channels are already in order.
          rgb[q] = src[p];
          rgb[q + 1] = src[p + 1];
          rgb[q + 2] = src[p + 2];
        }
      }

      // A signed input tensor wants the same pixels centred on zero. In two's complement,
      // u - 128 has the byte representation u ^ 0x80, so the shift is one XOR per channel
      // rather than a second buffer.
      if (modelIO.inputSigned) {
        for (let i = 0; i < rgb.length; i++) rgb[i] = rgb[i] ^ 0x80;
      }

      const outputs = loadedModel.runSync([rgb.buffer]);
      // One [1, N] score vector. Float builds hand back probabilities already in 0–1;
      // quantized builds hand back bytes, signed or not depending on the export. Reading it
      // as the wrong type produces a confident wrong label rather than an error, so branch on
      // the dtype resolved at load instead of assuming (see ModelIO in classifier.ts).
      const scores = modelIO.outputFloat
        ? new Float32Array(outputs[0])
        : modelIO.outputSigned
          ? new Int8Array(outputs[0])
          : new Uint8Array(outputs[0]);
      // Dequantize to 0–1 so SCORE_THRESHOLD means the same thing across all three. Signed
      // softmax outputs use zero_point -128, so shifting by 128 lands them on the same scale.
      const zero = modelIO.outputSigned ? -128 : 0;
      const scale = modelIO.outputFloat ? 1 : 1 / 255;

      // Classifier output isn't sorted, so this is a plain argmax over the real classes
      // (skipping the leading background slot on models that have one). Seeded below the
      // minimum possible score so the first class can win. Every classification surfaces —
      // the consult-local-guide fallback handles labels no region lists.
      const offset = modelIO.labelOffset;
      let bestIndex = -1;
      let bestValue = -Infinity;
      for (let i = offset; i < scores.length; i++) {
        if (scores[i] > bestValue) {
          bestValue = scores[i];
          bestIndex = i;
        }
      }
      const score = (bestValue - zero) * scale;
      const label = bestIndex >= 0 ? IMAGENET_LABELS[bestIndex - offset] : undefined;
      const best: Detection | null =
        label != null && score >= SCORE_THRESHOLD ? { label, score } : null;
      // Tap mode commits the one-shot result; continuous mode updates the live label.
      scheduleOnRN(tapMode ? reportTapResult : reportDetection, best);
    },
    onFrameDropped: (reason) => {
      "worklet";
      scheduleOnRN(reportDropped, reason);
    },
  });

  // Reset readiness/probe/detection on blur so returning to the tab can't tap through the
  // warm-up window, and nothing on screen reflects a stale reading from before you navigated
  // away. Also clears an in-flight tap scan so it can't hang "Scanning…" across a blur.
  useEffect(() => {
    if (!isFocused) {
      setPreviewReady(false);
      setFps(null);
      setDropped(0);
      setDetection(null);
      setScanning(false);
      autoArmedRef.current = true; // re-arm so returning to the tab can auto-fire again
      if (scanTimeout.current) {
        clearTimeout(scanTimeout.current);
        scanTimeout.current = null;
      }
    }
  }, [isFocused]);

  // Leaving continuous mode's live detection on screen while switching to tap mode would be
  // stale, so clear it when the mode changes — and re-arm auto-scan for the next entry.
  useEffect(() => {
    setDetection(null);
    autoArmedRef.current = true;
  }, [tapMode]);

  // Clear any pending tap timeout when the screen unmounts.
  useEffect(() => {
    return () => {
      if (scanTimeout.current) clearTimeout(scanTimeout.current);
    };
  }, []);

  if (!hasPermission) {
    return (
      <View style={[styles.container, styles.centered, { padding: 24 }]}>
        <Text style={styles.permissionText}>Camera access is needed to scan items.</Text>
        <Button label="Allow camera access" onPress={requestPermission} />
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.permissionText}>Starting camera…</Text>
      </View>
    );
  }

  const modelLoading = model.state === "loading";
  const modelError = model.state === "error";
  const modelReady = !modelLoading && !modelError;

  // Tap mode only: fire a one-shot inference by bumping the capture generation, and let the
  // next serviced frame commit its result via reportTapResult. (Auto mode has no button — it
  // commits itself from reportDetection.)
  const handleShutter = () => {
    if (scanning || !previewReady || !modelReady) return;
    setScanning(true);
    setCaptureGen((g) => g + 1);
    if (scanTimeout.current) clearTimeout(scanTimeout.current);
    scanTimeout.current = setTimeout(() => setScanning(false), 2500);
  };

  // A not-ready message shared by both modes; null once the camera + model are live.
  const statusPrefix = modelLoading
    ? "Loading model…"
    : modelError
      ? "Model failed to load"
      : !previewReady
        ? "Starting camera…"
        : null;

  const shutterDisabled = statusPrefix != null || scanning;
  // Only a not-ready state or an in-flight tap scan gets a label; a live camera says nothing.
  const status = statusPrefix ?? (tapMode && scanning ? "Scanning…" : null);

  return (
    <View style={styles.container}>
      {/* Stays mounted across a blur — only `isActive` toggles. Unmounting here instead
          would tear down the AVCaptureSession synchronously on the main thread via view
          dealloc, racing the frame-processor thread and aborting in AVFCapture; `isActive`
          releases it through vision-camera's own async path instead. */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused}
        outputs={[frameOutput]}
        constraints={CAMERA_CONSTRAINTS}
        onPreviewStarted={() => setPreviewReady(true)}
        onPreviewStopped={() => setPreviewReady(false)}
      />

      {/* Header, matching the other tabs: wordmark left, the place chip right. The throughput
          probe hangs under the chip as a mono stamp, dev builds only. */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.headerRow} pointerEvents="box-none">
          <Wordmark color={scanSurface.text} dotColor={scanSurface.reticle} />
          <LocationChip onDark />
        </View>
        {__DEV__ && previewReady && (
          <Text style={styles.probeText} pointerEvents="none">
            {fps == null ? "measuring…" : `${fps} fps`}
            {dropped > 0 ? `  ·  ${dropped} dropped` : ""}
          </Text>
        )}
      </View>

      {/* Reticle — four green corners, 3px, on a 12 radius. */}
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      {/* Bottom cluster: a status line while not ready, and (tap mode) the shutter. No live
          "looks like" card — the result sheet is the answer, and a guess before it only
          competes with it. */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        {status != null && <Text style={styles.status}>{status}</Text>}

        {/* Tap mode only: a centred shutter for the one-shot scan. Auto mode has no button —
            it commits on its own once a detection clears the threshold. */}
        {tapMode && (
          <Pressable
            style={({ pressed }) => [
              styles.shutter,
              { backgroundColor: pressed ? scanSurface.shutterPressed : scanSurface.shutter },
              shutterDisabled && styles.shutterDisabled,
            ]}
            onPress={handleShutter}
            disabled={shutterDisabled}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Scan"
            accessibilityState={{ disabled: shutterDisabled, busy: scanning }}
          />
        )}
      </View>
    </View>
  );
}

const RETICLE = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCAN_BG,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  permissionText: {
    ...TYPE.bodySm,
    color: scanSurface.text,
    textAlign: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 22,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  probeText: {
    ...TYPE.micro,
    color: scanSurface.text2,
    textAlign: "right",
  },
  frameWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 240,
    height: 240,
    // Sits a little above centre so the bottom cluster doesn't crowd it.
    marginBottom: 80,
  },
  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: scanSurface.reticle,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: RETICLE, borderLeftWidth: RETICLE, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: RETICLE, borderRightWidth: RETICLE, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: RETICLE, borderLeftWidth: RETICLE, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: RETICLE, borderRightWidth: RETICLE, borderBottomRightRadius: 12 },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    gap: 18,
  },
  status: {
    ...TYPE.small,
    color: scanSurface.text2,
    textAlign: "center",
  },
  shutter: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: radii.chip,
    borderWidth: 4,
    borderColor: scanSurface.shutterRing,
  },
  shutterDisabled: { opacity: 0.45 },
});
