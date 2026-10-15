"use client";
import { useTranslations } from "next-intl";

/** Shimmer placeholder bar (shimmer is switched off under prefers-reduced-motion). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

export default function LoadingState({ label }: { label?: string }) {
  const t = useTranslations("common");
  return (
    <div role="status" aria-live="polite" className="glass-card mx-auto flex w-full max-w-xl flex-col gap-3 p-6">
      <p className="text-sm font-medium text-ink-muted">{label ?? t("loading")}</p>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
