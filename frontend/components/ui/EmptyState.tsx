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
    <div className="glass-card flex flex-col items-center gap-2 border-dashed p-8 text-center">
      <span aria-hidden="true" className="icon-tile mb-1 !h-12 !w-12 !rounded-xl">
        <Inbox className="h-6 w-6" />
      </span>
      <p className="font-medium text-ink">{title ?? t("empty")}</p>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}
