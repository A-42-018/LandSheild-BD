"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ServiceId } from "./services";

/** "What you need" card shown beside (≥ 1024 px, always open) or above (collapsible) a service form; same list as the citizen charter. */
export default function WhatYouNeed({ service }: { service: ServiceId }) {
  const t = useTranslations("services");
  const need = Object.values(t.raw(`items.${service}.need`) as Record<string, string>);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setOpen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return (
    <aside aria-labelledby={`need-${service}`} className="glass-card p-0" data-testid="what-you-need">
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 lg:pointer-events-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="icon-tile !h-9 !w-9"><ListChecks className="h-5 w-5" /></span>
          <h2 id={`need-${service}`} className="flex-1 font-display text-base font-semibold text-ink">{t("whatYouNeed")}</h2>
          <ChevronDown aria-hidden="true" className="h-5 w-5 text-ink-muted transition-transform group-open:rotate-180 lg:hidden" />
        </summary>
        <ul className="space-y-2 px-4 pb-4 text-sm text-ink">
          {need.map((n) => (
            <li key={n} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
