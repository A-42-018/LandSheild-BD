"use client";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import Button from "./Button";

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  const t = useTranslations();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-critical/40 border-l-4 border-l-critical bg-critical-soft p-6 text-center">
      <AlertCircle aria-hidden="true" className="h-7 w-7 text-critical" />
      <p className="text-critical">{message ?? t("errors.generic")}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
