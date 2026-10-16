"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  label?: string;
  className?: string;
  /** "underline" (default, content tabs) or "segmented" (pill switch for 2-4 options). */
  variant?: "underline" | "segmented";
  /** Keep the tab row pinned under the header while the panel scrolls (result page). */
  sticky?: boolean;
}

export default function Tabs({ tabs, value, defaultValue, onValueChange, label, className, variant = "underline", sticky }: TabsProps) {
  const base = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs.find((x) => !x.disabled)?.id ?? "");
  const current = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((x) => !x.disabled);
    const idx = enabled.findIndex((x) => x.id === current);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % enabled.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = enabled[next];
    select(target.id);
    refs.current[target.id]?.focus();
  };

  // Phones: keep the active tab visible inside the horizontally scrolling row.
  useEffect(() => {
    const el = refs.current[current];
    const row = el?.parentElement;
    if (!el || !row || row.scrollWidth <= row.clientWidth) return;
    // Scroll the tab row only (scrollIntoView would also scroll the page).
    row.scrollLeft = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
  }, [current]);

  const segmented = variant === "segmented";
  const active = tabs.find((x) => x.id === current);

  return (
    <div className={className} data-variant={variant}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn(
          "scroll-fade flex gap-1 overflow-x-auto overflow-y-hidden",
          sticky && "sticky top-16 z-10 bg-surface-muted/90 backdrop-blur-sm",
          segmented ? "w-full rounded-xl bg-primary-soft p-1 sm:w-fit" : "border-b border-line",
        )}
      >
        {tabs.map((tab) => {
          const selected = tab.id === current;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              className={cn(
                "min-h-touch shrink-0 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                segmented
                  ? cn(
                      "flex-1 rounded-lg sm:flex-none",
                      selected ? "bg-surface text-primary shadow-raised" : "text-ink-muted hover:text-ink",
                    )
                  : cn(
                      "whitespace-nowrap border-b-2",
                      selected
                        ? "border-primary text-primary"
                        : "border-transparent text-ink-muted hover:border-line hover:text-ink",
                    ),
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div role="tabpanel" id={`${base}-panel-${active.id}`} aria-labelledby={`${base}-tab-${active.id}`} tabIndex={0} className="pt-4">
          {active.content}
        </div>
      )}
    </div>
  );
}
