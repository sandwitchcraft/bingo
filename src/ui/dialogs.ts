import { Alert, Platform } from "react-native";

// react-native-web ships Alert as `static alert() {}` — a silent no-op. Calling
// Alert.alert directly therefore does nothing at all on web rather than failing
// loudly, so route confirmations and notices through these instead.

export function confirmDestructive(options: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}): void {
  const { title, message, confirmLabel, onConfirm } = options;

  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

export function notify(title: string, message: string): void {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
