"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
      <span aria-hidden="true" className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Inbox className="h-6 w-6" />
      </span>
      <p className="font-medium text-ink">{title ?? t("empty")}</p>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}
