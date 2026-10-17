"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { History } from "lucide-react";
import { Link } from "@/i18n/navigation";
import StatusBadge from "@/components/domain/StatusBadge";
import { Card, ErrorState, LoadingState, Table, type Column } from "@/components/ui";
import { formatDateTime } from "@/features/result/format";
import type { DecisionItem } from "@/features/officer/types";
import { HISTORY_PAGE_SIZE, useMyDecisions } from "./useReviewerData";

export default function MyHistory() {
  const t = useTranslations("reviewer.history");
  const tt = useTranslations("upload.types");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const q = useMyDecisions(page);

  const columns: Column<DecisionItem>[] = [
    {
      key: "land",
      header: t("cols.land"),
      render: (r) => (
        <Link href={`/officer/review/${r.document_id}`} className="font-medium text-primary underline">
          {r.land_id ?? t("noLand")}
        </Link>
      ),
    },
    { key: "type", header: t("cols.type"), render: (r) => (r.document_type && ["DEED", "KHATIAN", "PORCHA", "MUTATION", "OTHER"].includes(r.document_type) ? tt(r.document_type) : (r.document_type ?? "—")) },
    { key: "decision", header: t("cols.decision"), render: (r) => <StatusBadge code={r.decision} /> },
    { key: "reason", header: t("cols.reason"), className: "max-w-xs whitespace-normal break-words", render: (r) => r.reason ?? "—" },
    { key: "when", header: t("cols.when"), render: (r) => formatDateTime(r.created_at, locale, "—") },
  ];

  return (
    <Card title={t("title")} icon={<History />} id="my-history">
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div aria-busy={q.isFetching} data-testid="history-table">
          <Table
            caption={t("title")}
            columns={columns}
            rows={q.data.items}
            rowKey={(r) => r.id}
            compact
            page={page}
            pageSize={HISTORY_PAGE_SIZE}
            total={q.data.total}
            onPageChange={setPage}
            emptyText={t("empty")}
          />
        </div>
      )}
    </Card>
  );
}
