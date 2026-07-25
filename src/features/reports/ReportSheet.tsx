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
  KeyboardAvoidingView,
  Platform,
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

import { BIN_LABEL, binColor, type BinType } from "@/core/bins";
import { getRegionPath, resolveScanResult } from "@/features/region/regionData";
import { useRegionRules } from "@/features/region/regionStore";
import { submitReport } from "@/features/reports/reports";
import { useReport, type ReportTarget } from "@/features/reports/reportStore";
import { CameraIcon, CheckIcon, RecyclingBoxIcon } from "@/features/reports/ReportIcons";
import { colors, FONT, radii, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

type Step = "choice" | "form" | "success";
type ReportType = "wrong_bin" | "wrong_item";

// The corrections a user can pick, including `consult-local-guide` — sometimes the right answer
// really is "the app shouldn't claim a bin for this." The currently-shown bin is filtered out
// below, since reporting it as wrong means it isn't the fix.
const CORRECT_BINS: BinType[] = ["recycling", "compost", "garbage", "consult-local-guide"];

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

      <KeyboardAvoidingView
        style={styles.anchor}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          onLayout={(e) => onSheetLayout(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.bgAlt,
              borderColor: theme.cardBorder,
              paddingBottom: insets.bottom + 28,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.handleZone}>
              <View style={[styles.grabber, { backgroundColor: theme.handleBar }]} />
            </View>
          </GestureDetector>

          {result && step === "choice" && (
            <Animated.View entering={FadeIn.duration(160)} style={styles.body}>
              <Text style={[styles.title, { color: theme.text }]}>What&apos;s incorrect?</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  pressed && { backgroundColor: theme.bgInput },
                ]}
                onPress={() => chooseType("wrong_bin")}
                accessibilityRole="button"
              >
                <RecyclingBoxIcon size={26} color={colors.slate} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    Incorrect Bin Placement
                  </Text>
                  <Text style={[styles.optionSub, { color: theme.textMuted }]}>
                    This item doesn&apos;t belong in{" "}
                    <Text style={{ fontFamily: FONT.bodyEmphasis, color: binColor(shownBin) }}>
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
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                    pressed && { backgroundColor: theme.bgInput },
                  ]}
                  onPress={() => chooseType("wrong_item")}
                  accessibilityRole="button"
                >
                  <CameraIcon size={26} color={colors.slate} />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      Misidentified object scan
                    </Text>
                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>
                      The scanner got the object/material wrong.
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
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[styles.formTitle, { color: theme.text }]}>Submit a report</Text>

                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Item</Text>
                <Text style={[styles.itemName, { color: theme.text }]}>{result.display_name}</Text>

                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                  Currently sorted into
                </Text>
                <Text style={[styles.shownBin, { color: binColor(shownBin) }]}>
                  {BIN_LABEL[shownBin]}
                </Text>

                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Correct bin</Text>
                <View style={styles.binRow}>
                  {binOptions.map((bin) => {
                    const selected = correctBin === bin;
                    return (
                      <Pressable
                        key={bin}
                        style={[
                          styles.binBtn,
                          {
                            borderColor: selected ? colors.sprout : theme.cardBorder,
                            backgroundColor: selected ? theme.secondaryBg : "transparent",
                          },
                        ]}
                        onPress={() => setCorrectBin(bin)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.binBtnText, { color: binColor(bin) }]}>
                          {BIN_LABEL[bin]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Notes</Text>
                <TextInput
                  style={[
                    styles.notes,
                    {
                      backgroundColor: theme.bgInput,
                      borderColor: theme.cardBorder,
                      color: theme.text,
                    },
                  ]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything else we should know?"
                  placeholderTextColor={theme.textSubtle}
                  multiline
                  textAlignVertical="top"
                />

                <Pressable
                  style={[
                    styles.submit,
                    { backgroundColor: theme.primary },
                    (!correctBin || submitting) && styles.submitDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!correctBin || submitting}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !correctBin || submitting, busy: submitting }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={theme.primaryText} />
                  ) : (
                    <Text style={[styles.submitText, { color: theme.primaryText }]}>Submit</Text>
                  )}
                </Pressable>

                <Text style={[styles.footnote, { color: theme.textMuted }]}>
                  This data will be shared anonymously with bin·go
                </Text>
              </ScrollView>
            </Animated.View>
          )}

          {step === "success" && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.success}>
              <Pressable onPress={close} style={styles.success} accessibilityRole="button">
                <View style={[styles.checkDisc, { backgroundColor: theme.primary }]}>
                  <CheckIcon size={44} color={theme.primaryText} />
                </View>
                <Text style={[styles.successText, { color: theme.text }]}>
                  Thanks for submitting a report!
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    maxHeight: "90%",
  },
  handleZone: { paddingTop: 10, paddingBottom: 12, alignItems: "center" },
  grabber: { width: 40, height: 4, borderRadius: 2 },
  body: { paddingTop: 4 },
  title: {
    fontFamily: FONT.heading,
    fontSize: 22,
    letterSpacing: -0.3,
    marginBottom: 18,
  },
  // The form's own heading: larger than the choice title, and tight to the first field —
  // the first field's own `marginTop` supplies the gap, so this carries almost no bottom margin.
  formTitle: {
    fontFamily: FONT.heading,
    fontSize: 27,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  // Choice options
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { fontFamily: FONT.bodyEmphasis, fontSize: 15 },
  optionSub: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18 },
  // Form
  fieldLabel: {
    fontFamily: FONT.utility,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 14,
  },
  itemName: { fontFamily: FONT.display, fontSize: 22, letterSpacing: -0.3 },
  shownBin: { fontFamily: FONT.heading, fontSize: 18 },
  // Corrected-bin buttons: bold, bin-coloured labels; the selected one gets a green highlight.
  binRow: { flexDirection: "row", gap: 10 },
  binBtn: {
    flex: 1,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  // Centred so "Consult Local Guide" wrapping to two lines stays balanced; the row's default
  // stretch keeps the shorter siblings the same height.
  binBtnText: { fontFamily: FONT.bodyEmphasis, fontSize: 14, textAlign: "center" },
  notes: {
    minHeight: 84,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: FONT.body,
    fontSize: 14,
  },
  submit: {
    borderRadius: radii.button,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { fontFamily: FONT.utilityStrong, fontSize: 13, letterSpacing: 0.4 },
  footnote: {
    fontFamily: FONT.body,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 14,
  },
  // Success
  success: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 20 },
  checkDisc: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  successText: { fontFamily: FONT.heading, fontSize: 18, letterSpacing: -0.2, textAlign: "center" },
});
