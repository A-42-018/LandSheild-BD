"use client";
import { useLocale, useTranslations } from "next-intl";
import { Activity as ActivityIcon, CircleDot } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { formatDateTime } from "@/features/result/format";
import { useActivity } from "./useOfficerData";
import { KNOWN_ACTIONS } from "./types";

export default function Activity() {
  const t = useTranslations("officer.activity");
  const te = useTranslations("errors");
  const tr = useTranslations("roles");
  const locale = useLocale();
  const q = useActivity();

  return (
    <Card title={t("title")} icon={<ActivityIcon />} data-testid="activity-card">
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError || !q.data ? (
        <ErrorState
          message={q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined}
          onRetry={() => q.refetch()}
        />
      ) : q.data.items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul aria-label={t("title")} className="flex flex-col">
          {q.data.items.map((a) => (
            <li key={a.id} className="relative ms-3 flex flex-col gap-0.5 border-l-2 border-dashed border-primary/30 pb-4 ps-6 last:border-transparent last:pb-0">
              <span aria-hidden="true" className="absolute -left-[13px] top-0 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-primary/30 bg-surface text-primary"><CircleDot className="h-3.5 w-3.5" /></span>
              <span className="text-sm font-medium text-ink">
                {KNOWN_ACTIONS.includes(a.action) ? t(`actions.${a.action}`) : a.action}
              </span>
              <span className="text-xs text-ink-muted">
                {a.actor ? `${a.actor.name} (${["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"].includes(a.actor.role) ? tr(a.actor.role) : a.actor.role})` : t("system")}
                {" · "}
                {formatDateTime(a.created_at, locale, "—")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
