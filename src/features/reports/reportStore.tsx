/**
 * Global state for the "report incorrect sort" flow. The sheet itself (`ReportSheet`) is
 * mounted once in the root layout — above the tabs and the scan result sheet, but below the
 * error toast so a submit failure floats over it — and any result view opens it through
 * `useReport().open(itemKey, context)`.
 *
 * Being root-mounted (rather than a native `Modal` inside the result body) is what lets the
 * sheet sit under the toast in z-order and lets its swipe-to-dismiss gesture work — gesture
 * handlers only fire inside the app's `GestureHandlerRootView`, which a `Modal` escapes.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ReportContext = "scan" | "search";

export type ReportTarget = { itemKey: string; context: ReportContext };

type ReportValue = {
  /** The item being reported, or null when the sheet is closed. */
  target: ReportTarget | null;
  visible: boolean;
  open: (itemKey: string, context: ReportContext) => void;
  close: () => void;
};

const ReportContextObj = createContext<ReportValue | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReportTarget | null>(null);

  const open = useCallback((itemKey: string, context: ReportContext) => {
    setTarget({ itemKey, context });
  }, []);
  const close = useCallback(() => setTarget(null), []);

  const value = useMemo<ReportValue>(
    () => ({ target, visible: target !== null, open, close }),
    [target, open, close],
  );

  return <ReportContextObj.Provider value={value}>{children}</ReportContextObj.Provider>;
}

export function useReport(): ReportValue {
  const ctx = useContext(ReportContextObj);
  if (!ctx) {
    throw new Error("useReport must be used within a ReportProvider");
  }
  return ctx;
}
