/**
 * "Report incorrect sort" flow. A bottom sheet mounted once in the root layout and opened for
 * any item via `useReport().open(itemKey, context)` — see `reportStore.tsx` for why it lives
 * there (z-order under the toast; swipe gesture under the GestureHandlerRootView) rather than
 * in a native Modal.
 *
 * Three steps: `choice` (which kind of problem) → `form` (correct bin + notes) → `success`.
 * The choice step is scan-only — you can't misidentify an item you looked up by name, so the
 * search context skips straight to the form as a `wrong_bin` report (and, being the first
 * step, it gets no horizontal slide — only the vertical open animation).
 *
 * No image is attached: reports don't need one and the scan pipeline captures no photo.
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  SlideInRight,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BIN_LABEL, type BinType } from "@/core/bins";
import { getRegionPath, resolveScanResult } from "@/features/region/regionData";
import { useRegionRules } from "@/features/region/regionStore";
import { submitReport } from "@/features/reports/reports";
import { useReport, type ReportTarget } from "@/features/reports/reportStore";
import { CameraIcon, CheckIcon, RecyclingBoxIcon } from "@/features/reports/ReportIcons";
import { FONT, radii, TYPE, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

type Step = "choice" | "form" | "success";
type ReportType = "wrong_bin" | "wrong_item";

// The corrections a user can pick, including `consult-local-guide` — sometimes the right answer
// really is "the app shouldn't claim a bin for this." The currently-shown bin is filtered out
// below, since reporting it as wrong means it isn't the fix.
const CORRECT_BINS: BinType[] = ["compost", "recycling", "garbage", "consult-local-guide"];

const EASING = Easing.bezier(0.32, 0.72, 0, 1);

export function ReportSheet() {
  const { theme } = useTheme();
  const { showError } = useToast();
  const rules = useRegionRules();
  const { target, visible, close } = useReport();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Keep the last target rendered through the slide-out, so content doesn't blank mid-animation.
  const lastTargetRef = useRef<ReportTarget | null>(null);
  const isNewOpen = target != null && target !== lastTargetRef.current;
  if (target) lastTargetRef.current = target;
  const active = target ?? lastTargetRef.current;
  const context = active?.context ?? "scan";
  const result = active ? resolveScanResult(rules, active.itemKey) : null;
  const shownBin = result?.bin ?? "consult-local-guide";
  // The currently-shown bin is excluded — you're reporting that it's wrong, so it's not a fix.
  const binOptions = CORRECT_BINS.filter((bin) => bin !== shownBin);

  const [step, setStep] = useState<Step>("choice");
  const [reportType, setReportType] = useState<ReportType>("wrong_bin");
  const [correctBin, setCorrectBin] = useState<BinType | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const translateY = useSharedValue(height);
  const sheetH = useSharedValue(height);
  const startY = useSharedValue(0);

  // Reset to the starting step the instant a new target arrives — synchronously during render,
  // so the search context (which starts on the form) never flashes the choice step first.
  if (isNewOpen) {
    setStep(context === "search" ? "form" : "choice");
    setReportType("wrong_bin");
    setCorrectBin(null);
    setNote("");
    setSubmitting(false);
  }

  // Drive the vertical slide on open/close (visibility-only; the step is handled above).
  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : sheetH.value, {
      duration: visible ? 320 : 260,
      easing: EASING,
    });
  }, [visible]);

  // Success confirmation auto-dismisses after a beat (also tap- and swipe-dismissable).
  useEffect(() => {
    if (step !== "success") return;
    const t = setTimeout(close, 1600);
    return () => clearTimeout(t);
  }, [step, close]);

  const onSheetLayout = (h: number) => {
    sheetH.value = h;
    if (!visible) translateY.value = h; // park a closed sheet just below the screen edge
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, startY.value + e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 90 || e.velocityY > 600) {
        translateY.value = withTiming(sheetH.value, { duration: 220, easing: EASING }, (fin) => {
          if (fin) runOnJS(close)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 200, easing: EASING });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, sheetH.value], [1, 0], "clamp"),
  }));

  const chooseType = (type: ReportType) => {
    setReportType(type);
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!correctBin || submitting || !active) return;
    setSubmitting(true);
    // reported_bin holds the corrected bin; the originally-shown bin is preserved in the note
    // so a reviewer sees before → after without re-deriving it.
    const trimmed = note.trim();
    const userNote = `Originally shown: ${BIN_LABEL[shownBin]}` + (trimmed ? ` | ${trimmed}` : "");
    const { success, error } = await submitReport({
      region: getRegionPath(rules),
      itemKey: active.itemKey,
      reportedBin: correctBin,
      reportType,
      userNote,
    });
    setSubmitting(false);
    if (success) {
      setStep("success");
    } else {
      if (__DEV__) console.warn("[reports] submit failed", error);
      showError("Couldn't send your report. Check your connection and try again.");
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "box-none" : "none"}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, scrimStyle]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          onLayout={(e) => onSheetLayout(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.line,
              paddingBottom: insets.bottom + 28,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.handleZone}>
              <View style={[styles.grabber, { backgroundColor: theme.lineStrong }]} />
            </View>
          </GestureDetector>

          {result && step === "choice" && (
            <Animated.View entering={FadeIn.duration(160)} style={styles.body}>
              <Text style={[styles.title, { color: theme.text }]}>What&apos;s wrong?</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: theme.card, borderColor: theme.line },
                  pressed && { backgroundColor: theme.surface },
                ]}
                onPress={() => chooseType("wrong_bin")}
                accessibilityRole="button"
              >
                <RecyclingBoxIcon size={26} color={theme.text2} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    Wrong bin
                  </Text>
                  <Text style={[styles.optionSub, { color: theme.text2 }]}>
                    This item doesn&apos;t belong in{" "}
                    <Text style={{ fontFamily: FONT.bodyStrong, color: theme.bins[shownBin].tintInk }}>
                      {BIN_LABEL[shownBin]}
                    </Text>
                    .
                  </Text>
                </View>
              </Pressable>

              {context === "scan" && (
                <Pressable
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: theme.card, borderColor: theme.line },
                    pressed && { backgroundColor: theme.surface },
                  ]}
                  onPress={() => chooseType("wrong_item")}
                  accessibilityRole="button"
                >
                  <CameraIcon size={26} color={theme.text2} />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      Wrong item
                    </Text>
                    <Text style={[styles.optionSub, { color: theme.text2 }]}>
                      The scan named the wrong thing.
                    </Text>
                  </View>
                </Pressable>
              )}
            </Animated.View>
          )}

          {result && step === "form" && (
            <Animated.View
              entering={context === "scan" ? SlideInRight.duration(240) : undefined}
              style={styles.body}
            >
              {/* The sheet stays anchored at the bottom when the keyboard opens — deliberately
                  NOT lifted to fill the screen, so the scrim above it stays tappable and the
                  grabber stays swipeable, both of which dismiss the sheet mid-edit. Instead iOS
                  insets this scroll view by the keyboard and scrolls the focused field
                  (the Notes box) up into the space that remains above the keyboard. */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.formTitle, { color: theme.text }]}>Submit a report</Text>

                <Text style={[styles.fieldLabel, { color: theme.text2 }]}>Item</Text>
                <Text style={[styles.itemName, { color: theme.text }]}>{result.display_name}</Text>

                <Text style={[styles.fieldLabel, { color: theme.text2 }]}>
                  Currently sorted into
                </Text>
                <Text style={[styles.shownBin, { color: theme.bins[shownBin].tintInk }]}>
                  {BIN_LABEL[shownBin]}
                </Text>

                <Text style={[styles.fieldLabel, { color: theme.text2 }]}>Correct bin</Text>
                <View style={styles.binRow}>
                  {binOptions.map((bin) => {
                    const selected = correctBin === bin;
                    return (
                      <Pressable
                        key={bin}
                        style={[
                          styles.binBtn,
                          {
                            borderColor: selected ? theme.bins[bin].fill : "transparent",
                            backgroundColor: theme.bins[bin].tint,
                          },
                        ]}
                        onPress={() => setCorrectBin(bin)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.binBtnText, { color: theme.bins[bin].tintInk }]}>
                          {BIN_LABEL[bin]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.fieldLabel, { color: theme.text2 }]}>Notes</Text>
                <TextInput
                  style={[
                    styles.notes,
                    {
                      backgroundColor: theme.card2,
                      borderColor: theme.line,
                      color: theme.text,
                    },
                  ]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything else worth knowing?"
                  placeholderTextColor={theme.text2}
                  multiline
                  textAlignVertical="top"
                />

                <Pressable
                  style={[
                    styles.submit,
                    { backgroundColor: theme.accent },
                    (!correctBin || submitting) && styles.submitDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!correctBin || submitting}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !correctBin || submitting, busy: submitting }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={theme.onAccent} />
                  ) : (
                    <Text style={[styles.submitText, { color: theme.onAccent }]}>Submit</Text>
                  )}
                </Pressable>

                <Text style={[styles.footnote, { color: theme.text2 }]}>
                  Sent anonymously to bin·go.
                </Text>
              </ScrollView>
            </Animated.View>
          )}

          {step === "success" && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.success}>
              <Pressable onPress={close} style={styles.success} accessibilityRole="button">
                <View style={[styles.checkDisc, { backgroundColor: theme.accent }]}>
                  <CheckIcon size={44} color={theme.onAccent} />
                </View>
                <Text style={[styles.successText, { color: theme.text }]}>
                  Thanks. Your report is in.
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radii.screen,
    borderTopRightRadius: radii.screen,
    borderWidth: 1,
    paddingHorizontal: 22,
    maxHeight: "90%",
  },
  handleZone: { paddingTop: 10, paddingBottom: 12, alignItems: "center" },
  grabber: { width: 40, height: 4, borderRadius: 2 },
  body: { paddingTop: 4 },
  title: { ...TYPE.h3, marginBottom: 18 },
  // The form's own heading: larger than the choice title, and tight to the first field —
  // the first field's own `marginTop` supplies the gap, so this carries almost no bottom margin.
  formTitle: { ...TYPE.h3, marginBottom: 2 },
  // Choice options
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
  },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { ...TYPE.title },
  optionSub: { ...TYPE.small },
  // Form
  fieldLabel: { ...TYPE.micro, marginBottom: 6, marginTop: 16 },
  itemName: { ...TYPE.h4 },
  shownBin: { ...TYPE.title },
  // Corrected-bin buttons: each in its bin's tint with its tint ink; the selected one takes
  // the bin's full fill as its border.
  binRow: { flexDirection: "row", gap: 8 },
  binBtn: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 2,
    paddingVertical: 13,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  // Centred so "Consult local guide" wrapping to two lines stays balanced; the row's default
  // stretch keeps the shorter siblings the same height.
  binBtnText: { ...TYPE.rowBin, textAlign: "center" },
  notes: {
    ...TYPE.note,
    minHeight: 84,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submit: {
    borderRadius: radii.chip,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { ...TYPE.title },
  footnote: { ...TYPE.mono, textAlign: "center", marginTop: 14 },
  // Success
  success: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 20 },
  checkDisc: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  successText: { ...TYPE.title, textAlign: "center" },
});
