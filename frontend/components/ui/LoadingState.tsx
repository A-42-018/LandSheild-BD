"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Shimmer placeholder bar (shimmer is switched off under prefers-reduced-motion). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

/** After this long a slow connection is the likely cause, so say so (U4.5). */
export const SLOW_AFTER_MS = 8000;

export default function LoadingState({ label }: { label?: string }) {
  const t = useTranslations("common");
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div role="status" aria-live="polite" className="glass-card mx-auto flex w-full max-w-xl flex-col gap-3 p-6">
      <p className="text-sm font-medium text-ink-muted">{label ?? t("loading")}</p>
      {slow && <p className="text-sm text-ink-muted" data-testid="loading-slow">{t("slow")}</p>}
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
