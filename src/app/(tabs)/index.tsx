import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useScanResult } from "@/lib/scanResult";
import { FONT } from "@/lib/theme";

// Fixed dark scan-environment background per spec, independent of app theme.
const SCAN_BG = "#0a1a0c";
const FRAME_WHITE = "#ffffff";
const FRAME_GREEN = "#4ade80";

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { showResult } = useScanResult();
  const [scanning, setScanning] = useState(false);

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
        <Text style={styles.permissionText}>We need camera access to scan items.</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const handleScan = async () => {
    if (scanning || !cameraRef.current) return;
    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        const fakeDetectedItem = "plastic_bottle"; // placeholder until ML is wired in
        showResult(fakeDetectedItem);
      }
    } finally {
      setScanning(false);
    }
  };

  const cornerColor = scanning ? FRAME_GREEN : FRAME_WHITE;

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" ref={cameraRef} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>SortScan</Text>
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
          <Text style={styles.scanningLabel}>SCANNING…</Text>
        ) : (
          <Pressable style={styles.tapTarget} onPress={handleScan} hitSlop={16}>
            <View style={styles.outerRing}>
              <View style={styles.innerCircle} />
            </View>
            <Text style={styles.tapLabel}>TAP TO SCAN</Text>
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
    fontFamily: FONT.regular,
    color: "#e8f5e9",
  },
  permissionText: {
    fontFamily: FONT.regular,
    color: "#e8f5e9",
    textAlign: "center",
    marginBottom: 20,
    fontSize: 14,
  },
  permissionButton: {
    backgroundColor: FRAME_GREEN,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontFamily: FONT.medium,
    color: "#052e16",
    fontSize: 14,
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
  eyebrow: {
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#3d5c42",
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
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  innerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(74,222,128,0.15)",
    borderWidth: 1.5,
    borderColor: FRAME_GREEN,
  },
  tapLabel: {
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
  },
  scanningLabel: {
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: FRAME_GREEN,
  },
});
