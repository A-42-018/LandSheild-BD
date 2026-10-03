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
        <ul aria-label={t("title")} className="flex flex-col divide-y divide-line">
          {q.data.items.map((a) => (
            <li key={a.id} className="relative flex flex-col gap-0.5 py-2 pl-6 first:pt-0 last:pb-0">
              <CircleDot aria-hidden="true" className="absolute left-0 top-2.5 h-4 w-4 text-primary" />
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
