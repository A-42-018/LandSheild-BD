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
    <div role="alert" className="glass-card flex flex-col items-center gap-3 border-l-[3px] border-l-critical p-6 text-center">
      <span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-critical-soft text-critical">
        <AlertCircle className="h-6 w-6" />
      </span>
      <p className="text-ink">{message ?? t("errors.generic")}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
