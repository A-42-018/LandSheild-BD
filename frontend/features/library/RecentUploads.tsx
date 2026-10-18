"use client";
import { useLocale, useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";
import StatusBadge from "@/components/domain/StatusBadge";
import { Badge, Card, ErrorState, LoadingState } from "@/components/ui";
import { formatDateTime } from "@/features/result/format";
import { FileIcon } from "./LibraryView";
import { documentHref } from "./types";
import { useRecentUploads } from "./useLibrary";

/** Officer home: the last five documents I uploaded, linking to the full library. */
export default function RecentUploads() {
  const t = useTranslations("library.recent");
  const tl = useTranslations("library");
  const locale = useLocale();
  const q = useRecentUploads();
  return (
    <Card title={t("title")} icon={<FolderOpen />}>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="flex flex-col gap-3" data-testid="recent-uploads">
          {q.data.items.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {q.data.items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3">
                  <FileIcon type={r.file_type} />
                  <Link href={documentHref(r)} className="font-medium text-primary underline">{r.deed_no ?? r.land_id ?? tl("noNumber")}</Link>
                  <StatusBadge code={r.processing_status} />
                  {r.digitised && <Badge tone="verified">{tl("digitisedYes", { version: r.approved_version ?? 0 })}</Badge>}
                  <span className="ml-auto text-xs text-ink-muted">{formatDateTime(r.created_at, locale, "—")}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/officer/documents" className="text-sm font-medium text-primary underline">{t("all")}</Link>
        </div>
      )}
    </Card>
  );
}
