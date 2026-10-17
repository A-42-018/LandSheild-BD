"use client";
import { useEffect, useRef } from "react";

export type ShortcutKey = "A" | "R" | "N";
export type ShortcutHandlers = Partial<Record<ShortcutKey, () => void>>;

const TYPING = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

/** Reviewer keys (A approve, R reject, N next). Matched on the physical key (`e.code`) so they also work
 *  with a Bangla keyboard layout. Ignored while typing, with Ctrl/Cmd/Alt held, or while a dialog is open. */
export function useReviewShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(TYPING)) return;
      if (document.querySelector("[role='dialog'], [aria-modal='true']")) return;
      const key = /^Key([ARN])$/.exec(e.code)?.[1] as ShortcutKey | undefined;
      const fn = key && ref.current[key];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
