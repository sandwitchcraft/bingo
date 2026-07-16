import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Wordmark } from "@/components/Wordmark";
import { getRandomItemKey } from "@/lib/regionData";
import { useScanResult } from "@/lib/scanResult";
import { colors, FONT, radii } from "@/lib/theme";

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

// The capture only ever feeds the classifier (224x224 once the model lands), never the
// UI, so resolution above ~2MP is pure latency. Left alone, iOS captures at full sensor
// resolution — up to 48MP — then crops, reorients and re-encodes it at quality 1.0.
// Dropping the session preset shrinks the image through that whole pipeline.
// Note: expo-camera's skipProcessing is Android-only; iOS silently discards it.
const PICTURE_SIZE = "1920x1080";

const CAPTURE_OPTIONS = {
  quality: 0.3,
  shutterSound: false,
} as const;

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { showResult } = useScanResult();
  const [scanning, setScanning] = useState(false);
  // The tabs stay mounted when you navigate away, so CameraView has to be
  // unmounted explicitly or it keeps holding the capture session (and the
  // OS camera indicator) alive on the History/Settings tabs.
  const isFocused = useIsFocused();

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered, { padding: 24 }]}>
        <Text style={styles.permissionText}>Camera access is required to scan items.</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Enable camera access</Text>
        </Pressable>
      </View>
    );
  }

  const handleScan = async () => {
    if (scanning || !cameraRef.current) return;
    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync(CAPTURE_OPTIONS);
      if (photo) {
        showResult(getRandomItemKey()); // placeholder until ML is wired in
      }
    } finally {
      setScanning(false);
    }
  };

  const cornerColor = scanning ? FRAME_ACTIVE : FRAME_IDLE;

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          ref={cameraRef}
          pictureSize={PICTURE_SIZE}
        />
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

      {/* Tap affordance */}
      <View style={[styles.affordanceWrap, { bottom: insets.bottom + 40 }]}>
        {scanning ? (
          <Text style={styles.scanningLabel}>Scanning…</Text>
        ) : (
          <Pressable style={styles.tapTarget} onPress={handleScan} hitSlop={16}>
            <View style={styles.outerRing}>
              <View style={styles.innerCircle} />
            </View>
            <Text style={styles.tapLabel}>Tap to scan</Text>
          </Pressable>
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
  scanningLabel: {
    fontFamily: FONT.utilityStrong,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.sprout,
  },
});
