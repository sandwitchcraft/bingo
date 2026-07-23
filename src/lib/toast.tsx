import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * In-app error notifications: a red banner that drops in from the top of the screen.
 *
 * This exists because `Alert.alert` (see `dialogs.ts`) is the wrong shape for a failure the
 * user didn't ask about — a modal demands a dismissal for something they can only shrug at.
 * Reserve it for that: a *question* still belongs in a dialog, and a failure the user is
 * already looking at (the region picker's inline line) still belongs next to the thing that
 * failed. This is for errors with nowhere else to surface.
 *
 * State lives here; `components/ErrorToast.tsx` renders it. Both are mounted once, at the
 * root, so any screen can raise one without owning any UI for it.
 */

export type Toast = {
  /** Bumped per call so an identical repeated message still re-triggers the animation. */
  id: number;
  message: string;
};

type ToastValue = {
  toast: Toast | null;
  /** One sentence of what happened, plus how to fix it if there's an answer. No apology. */
  showError: (message: string) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(0);

  const showError = useCallback((message: string) => {
    nextId.current += 1;
    setToast({ id: nextId.current, message });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo<ToastValue>(
    () => ({ toast, showError, dismissToast }),
    [toast, showError, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
