"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fade/slide a block in once when its top first scrolls into view. Content already on screen at mount (first paint) and users who prefer
 *  reduced motion get no animation, and without JS everything simply stays visible. Only opacity/transform change, so there is no layout shift. */
export default function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"visible" | "hidden" | "shown">("visible");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: no motion on first paint
    setState("hidden");
    // Reveal once the block's top has entered the viewport (also when a jump scroll skipped past it).
    let raf = 0;
    const check = () => {
      raf = 0;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        setState("shown");
        window.removeEventListener("scroll", onScroll);
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} data-reveal={state} className={`${state === "visible" ? "" : "reveal"} ${className}`}>
      {children}
    </div>
  );
}
