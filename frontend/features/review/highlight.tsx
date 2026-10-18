"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** A value of the digital deed the reviewer clicked: where it was read on the original (H6d). */
export interface Highlight {
  /** which value (test id / aria) */
  id: string;
  label: string;
  page: number;
  /** x, y, w, h in pixels of the OCR image */
  bbox: number[];
}

interface Ctx {
  active: Highlight | null;
  show: (h: Highlight) => void;
  clear: () => void;
}

const HighlightContext = createContext<Ctx | null>(null);

/** null outside a review page: values then simply have no highlight. */
export const useHighlight = () => useContext(HighlightContext);

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Highlight | null>(null);
  const clear = useCallback(() => setActive(null), []);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
  const value = useMemo(
    () => ({ active, show: setActive, clear }),
    [active, clear],
  );
  return (
    <HighlightContext.Provider value={value}>
      {children}
    </HighlightContext.Provider>
  );
}

/** The box of a source, only when it is a usable x, y, w, h. */
export function usableBbox(b: number[] | null | undefined): number[] | null {
  return Array.isArray(b) &&
    b.length === 4 &&
    b.every((n) => Number.isFinite(n)) &&
    b[2] > 0 &&
    b[3] > 0
    ? b
    : null;
}
