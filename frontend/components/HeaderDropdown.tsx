"use client";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

// Below 1280px: full-width rows in the drop-down panel, active row has a gold side bar.
// From 1280px: text links in the bar, active one gold with a gold underline (reference header).
export const NAV_PILL =
  "relative flex min-h-12 w-full items-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
  "after:absolute after:bottom-3 after:left-0 after:top-3 after:w-[3px] after:rounded-full after:transition-opacity " +
  "min-[1280px]:inline-flex min-[1280px]:min-h-11 min-[1280px]:w-auto min-[1280px]:rounded-md min-[1280px]:px-3 min-[1280px]:text-[0.84rem] " +
  "min-[1280px]:after:bottom-1.5 min-[1280px]:after:left-3 min-[1280px]:after:right-3 min-[1280px]:after:top-auto min-[1280px]:after:h-0.5 min-[1280px]:after:w-auto";

export const NAV_PILL_ACTIVE = "bg-white/[0.07] text-gold-strong after:bg-gold after:opacity-100 min-[1280px]:bg-transparent";
export const NAV_PILL_IDLE =
  "text-white/90 after:bg-white/50 after:opacity-0 hover:bg-white/[0.05] hover:text-white min-[1280px]:hover:bg-transparent min-[1280px]:hover:after:opacity-100";

export interface DropdownItem {
  href: string;
  label: string;
  /** True for the page the user is on (aria-current). */
  current?: boolean;
  icon?: ReactNode;
}

/**
 * Disclosure dropdown for the header bar (button + list of links; not an ARIA menu, so Tab walks the links).
 * "nav": a bar link; inside the mobile drop-down panel it opens inline, from 1280px as a popover under the link.
 * "action": a gold button (sign in); always a popover aligned to the right edge (opens upward inside the mobile panel, where the button is the last row).
 * Closes on Escape (focus returns to the button), on a click outside, when focus leaves, and on navigation.
 */
export default function HeaderDropdown({
  id,
  label,
  items,
  variant = "nav",
  active = false,
  icon,
}: {
  id: string;
  label: string;
  items: DropdownItem[];
  variant?: "nav" | "action";
  active?: boolean;
  icon?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const isNav = variant === "nav";
  const panelId = `${id}-panel`;

  return (
    <div
      ref={root}
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      className={isNav ? "relative flex flex-col min-[1280px]:block" : "relative"}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={
          isNav
            ? `${NAV_PILL} justify-between gap-1.5 min-[1280px]:justify-start ${active || open ? NAV_PILL_ACTIVE : NAV_PILL_IDLE}`
            : "btn-gold inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold uppercase tracking-[0.06em] transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        }
      >
        {icon}
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className={
          isNav
            ? "[&[hidden]]:hidden mx-2 mb-1 mt-0.5 flex flex-col gap-0.5 border-l border-gold/40 pl-2 min-[1280px]:absolute min-[1280px]:left-0 min-[1280px]:top-full min-[1280px]:z-50 min-[1280px]:m-0 min-[1280px]:mt-2 min-[1280px]:w-64 min-[1280px]:rounded-xl min-[1280px]:border min-[1280px]:border-line min-[1280px]:bg-surface min-[1280px]:p-2 min-[1280px]:text-ink min-[1280px]:shadow-raised"
            : "absolute bottom-full right-0 z-50 mb-2 w-64 min-[1280px]:bottom-auto min-[1280px]:top-full min-[1280px]:mb-0 min-[1280px]:mt-2 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-2 text-ink shadow-raised"
        }
      >
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={i.current ? "page" : undefined}
              className={`flex min-h-12 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                isNav ? "max-[1279px]:text-white/90 max-[1279px]:hover:bg-white/[0.05] max-[1279px]:focus-visible:ring-white/70" : ""
              } ${
                i.current
                  ? isNav
                    ? "bg-primary-soft font-semibold text-primary max-[1279px]:bg-white/[0.07] max-[1279px]:text-gold-strong"
                    : "bg-primary-soft font-semibold text-primary"
                  : "hover:bg-primary-soft"
              }`}
            >
              {i.icon}
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
