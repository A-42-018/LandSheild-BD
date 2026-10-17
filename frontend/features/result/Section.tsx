"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/cn";

/** U2.4: one collapsible block of record detail. Native `<details>` (keyboard + screen-reader support); the body mounts only while open. */
export default function Section({
  title,
  count,
  defaultOpen = false,
  children,
  testId,
}: {
  title: string;
  /** Already formatted for the active locale (e.g. Bangla digits). */
  count?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} data-testid={testId} className="glass-card group">
      <summary
        data-testid="section-toggle"
        className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden"
      >
        <span className="flex items-center gap-2">
          {title}
          {count !== undefined && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{count}</span>}
        </span>
        <ChevronDown aria-hidden="true" className={cn("h-5 w-5 shrink-0 text-primary transition-transform", open && "rotate-180")} />
      </summary>
      {open && <div className="px-4 pb-4">{children}</div>}
    </details>
  );
}
