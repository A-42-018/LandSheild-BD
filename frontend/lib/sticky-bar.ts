"use client";
import { useCallback, useRef } from "react";

/**
 * U5.4 (WCAG 2.4.11 focus not obscured): ref for a `sticky bottom-0` action bar. While the bar is sticky,
 * its height goes to `--sticky-bar-h` on <html>, which globals.css adds to `scroll-padding-bottom`, so a
 * control reached with Tab scrolls into view above the bar instead of under it. The bar's height changes
 * with language, width and text size (169 px in Bangla at 360 px), so it is measured, not fixed.
 * Where the bar is static (result and report from `sm`), the padding is 0.
 */
export function useStickyBar() {
  const stop = useRef<(() => void) | null>(null);
  return useCallback((el: HTMLElement | null) => {
    stop.current?.();
    stop.current = null;
    if (!el) return;
    const root = document.documentElement;
    const set = () => {
      const sticky = getComputedStyle(el).position === "sticky";
      root.style.setProperty("--sticky-bar-h", sticky ? `${Math.ceil(el.getBoundingClientRect().height)}px` : "0px");
    };
    set();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(set);
    ro?.observe(el);
    window.addEventListener("resize", set);
    stop.current = () => {
      ro?.disconnect();
      window.removeEventListener("resize", set);
      root.style.removeProperty("--sticky-bar-h");
    };
  }, []);
}
