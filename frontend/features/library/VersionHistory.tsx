"use client";
import { useLocale, useTranslations } from "next-intl";
import { History } from "lucide-react";
import { Card, ErrorState, LoadingState } from "@/components/ui";
import { formatDateTime } from "@/features/result/format";
import { useRecordHistory } from "./useDocumentPage";

/** Who changed what and when in the selected version (from the audit log, H7b). */
export default function VersionHistory({ id, version }: { id: string; version: number }) {
  const t = useTranslations("library.doc.history");
  const locale = useLocale();
  const q = useRecordHistory(id);
  const v = q.data?.versions.find((x) => x.version === version);
  return (
    <Card title={t("title")} icon={<History />} data-testid="version-history">
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !v || v.events.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {v.events.map((e, i) => (
            <li key={`${e.kind}-${e.at}-${i}`} data-testid={`history-${e.kind}`} className="flex flex-col gap-1 border-l-2 border-line pl-3">
              <p className="text-sm font-medium text-ink">
                {t(`events.${e.kind}`)}
                <span className="font-normal text-ink-muted">
                  {" "}· {e.actor ? e.actor.name : t("byJob")} · {formatDateTime(e.at, locale, "—")}
                </span>
              </p>
              {e.changes.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                  {e.changes.map((c, j) => (
                    <li key={`${c.path}-${j}`} className="break-words text-xs text-ink-muted">
                      <span className="font-mono">{c.path}</span>: {c.old ?? "—"} → {c.new ?? "—"}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
