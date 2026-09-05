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

import { formatItemName } from "@/features/region/regionData";
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
import { Wordmark } from "@/ui/Wordmark";
import { colors, FONT, radii } from "@/ui/theme";

// The bundled base model (EfficientNet-Lite0, ImageNet-1k, byte-quantized) — see
// src/features/scan/classifier.ts for what it can and can't map onto region item keys.
// require() hands Metro a bundled-asset handle; `tflite` is registered as an asset extension
// in metro.config.js.
const MODEL_SOURCE = require("@/assets/models/efficientnet-lite0-int8.tflite");

// The scan screen is a fixed dark environment regardless of app theme — it sits over
// the camera feed, so it uses brand ink rather than the active theme's background.
const SCAN_BG = colors.ink;
const FRAME_IDLE = colors.paper;
const FRAME_ACTIVE = colors.sprout;

// Alpha overlays over the camera feed, as hex-alpha suffixes on the brand tokens so
// they track a token change instead of drifting as loose rgba() literals.
const RING_BORDER = `${colors.paper}33`; // paper 20%
const TAP_LABEL = `${colors.paper}8C`; // paper 55%
const RING_FILL = `${colors.sprout}26`; // sprout 15%

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
          Scanning needs the native camera — open the app on a device to scan. History and
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
        <Text style={styles.permissionText}>Camera access is required to scan items.</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Enable camera access</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading camera…</Text>
      </View>
    );
  }

  const modelLoading = model.state === "loading";
  const modelError = model.state === "error";
  const modelReady = !modelLoading && !modelError;

  // Tap mode only: fire a one-shot inference by bumping the capture generation, and let the
  // next serviced frame commit its result via reportTapResult. (Auto mode has no button — it
  // commits itself from reportDetection.)
  const handleTapScan = () => {
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
  const cornerColor = scanning || detection != null ? FRAME_ACTIVE : FRAME_IDLE;

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

      {previewReady && (
        <View style={[styles.probe, { top: insets.top + 44 }]} pointerEvents="none">
          <Text style={styles.probeText}>
            {fps == null ? "measuring…" : `${fps} fps`}
            {dropped > 0 ? `  ·  ${dropped} dropped` : ""}
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Wordmark size={18} color={colors.paper} />
      </View>

      {/* Scan frame */}
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: cornerColor }]} />
        </View>
      </View>

      {/* Affordance. Tap mode: a shutter ring for a one-shot scan. Auto mode: no button —
          a live readout of what the model sees as it homes in, then it fires on its own. */}
      <View style={[styles.affordanceWrap, { bottom: insets.bottom + 40 }]}>
        {tapMode ? (
          scanning ? (
            <Text style={styles.scanningLabel}>Scanning…</Text>
          ) : (
            // Dimmed rather than hidden while it can't be tapped: the control staying put
            // means a premature tap lands on a no-op instead of on whatever would have
            // reflowed into its place.
            <Pressable
              style={[styles.tapTarget, statusPrefix != null && styles.tapTargetWaiting]}
              onPress={handleTapScan}
              disabled={statusPrefix != null}
              hitSlop={16}
            >
              <View style={styles.outerRing}>
                <View style={styles.innerCircle} />
              </View>
              <Text style={styles.tapLabel}>{statusPrefix ?? "Tap to scan"}</Text>
            </Pressable>
          )
        ) : (
          <View style={styles.autoStatus} pointerEvents="none">
            {statusPrefix == null && detection != null && (
              // Confidence is shown next to the object on purpose while the base model
              // stands in — it makes what the model actually saw legible, and shows the
              // detection climbing toward the auto-fire threshold.
              <Text style={styles.detectionSub}>{Math.round(detection.score * 100)}% confident</Text>
            )}
            <Text style={styles.tapLabel}>
              {statusPrefix ??
                (detection != null
                  ? formatItemName(labelToItemKey(detection.label))
                  : "Point at an item")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCAN_BG,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: FONT.body,
    color: colors.paper,
    fontSize: 14,
  },
  permissionText: {
    fontFamily: FONT.body,
    color: colors.paper,
    textAlign: "center",
    marginBottom: 20,
    fontSize: 14,
  },
  permissionButton: {
    backgroundColor: colors.sproutDeep,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: radii.button,
  },
  permissionButtonText: {
    fontFamily: FONT.utilityStrong,
    color: colors.white,
    fontSize: 12,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  probe: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: "center",
  },
  probeText: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: TAP_LABEL,
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
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 8,
  },
  affordanceWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tapTarget: {
    alignItems: "center",
    gap: 12,
  },
  tapTargetWaiting: { opacity: 0.45 },
  // Auto mode has no tap target — just a centered live status readout in its place.
  autoStatus: {
    alignItems: "center",
    gap: 8,
    minHeight: 64,
    justifyContent: "center",
  },
  outerRing: {
    width: 64,
    height: 64,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: RING_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  innerCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.button,
    backgroundColor: RING_FILL,
    borderWidth: 1.5,
    borderColor: colors.sprout,
  },
  tapLabel: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: TAP_LABEL,
  },
  detectionSub: {
    fontFamily: FONT.utility,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.sprout,
  },
  scanningLabel: {
    fontFamily: FONT.utilityStrong,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.sprout,
  },
});
