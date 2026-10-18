"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** What a value asks of the reviewer: check it (low / medium confidence, an issue, unclear), nothing (fine) or a value the deed did not show (empty). */
export type FocusState = "check" | "fine" | "empty";
export type FocusMode = "all" | "check";

interface Ctx {
  mode: FocusMode;
  setMode: (m: FocusMode) => void;
  counts: Record<FocusState, number>;
  report: (id: string, s: FocusState) => void;
  forget: (id: string) => void;
}

const FocusContext = createContext<Ctx | null>(null);

/** null outside the review screen (e.g. the read-only record on the document page): nothing is hidden. */
export const useReviewFocus = () => useContext(FocusContext);

/**
 * The review screen's "only what needs checking" filter. Every value reports its state, so the bar
 * can count them; in "check" mode the values that look fine (and the empty ones) hide themselves.
 */
export function ReviewFocusProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<FocusMode>("all");
  const [states, setStates] = useState<Record<string, FocusState>>({});
  const report = useCallback(
    (id: string, s: FocusState) => setStates((m) => (m[id] === s ? m : { ...m, [id]: s })),
    [],
  );
  const forget = useCallback(
    (id: string) =>
      setStates((m) => {
        if (!(id in m)) return m;
        const next = { ...m };
        delete next[id];
        return next;
      }),
    [],
  );
  const counts = useMemo(() => {
    const c: Record<FocusState, number> = { check: 0, fine: 0, empty: 0 };
    for (const s of Object.values(states)) c[s] += 1;
    return c;
  }, [states]);
  const value = useMemo(() => ({ mode, setMode, counts, report, forget }), [mode, counts, report, forget]);
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

/** Registers one value; returns true when it should be hidden by the current filter. */
export function useFocusEntry(id: string, state: FocusState, keepShown = false): boolean {
  const ctx = useReviewFocus();
  const report = ctx?.report;
  const forget = ctx?.forget;
  useEffect(() => {
    report?.(id, state);
  }, [report, id, state]);
  useEffect(() => () => forget?.(id), [forget, id]);
  return !!ctx && ctx.mode === "check" && state !== "check" && !keepShown;
}

/** Values below are not counted or filtered (the historical deed's folded-away 13 core fields). */
export function NoFocus({ children }: { children: React.ReactNode }) {
  return <FocusContext.Provider value={null}>{children}</FocusContext.Provider>;
}
