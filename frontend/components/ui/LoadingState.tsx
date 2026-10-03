"use client";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

export default function LoadingState({ label }: { label?: string }) {
  const t = useTranslations("common");
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 p-8 text-ink-muted">
      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" />
      {label ?? t("loading")}
    </div>
  );
}
