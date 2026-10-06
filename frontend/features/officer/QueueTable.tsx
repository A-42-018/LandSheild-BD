"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ListChecks, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import StatusBadge from "@/components/domain/StatusBadge";
import RiskBadge from "@/components/domain/RiskBadge";
import { Badge, Button, Card, ErrorState, Input, LoadingState, Select, Table, type Column } from "@/components/ui";
import { formatDateTime } from "@/features/result/format";
import { useOfficerQueue } from "./useOfficerData";
import { PAGE_SIZE, QUEUE_FILTERS, SORT_KEYS, type QueueItem, type QueueParams, type QueueSortKey } from "./types";

const INITIAL: QueueParams = { filter: "", q: "", sort: "created_at", order: "desc", page: 1 };

export default function QueueTable() {
  const t = useTranslations("officer.queue");
  const tt = useTranslations("upload.types");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [params, setParams] = useState<QueueParams>(INITIAL);
  const [search, setSearch] = useState("");
  const q = useOfficerQueue(params);

  const patch = (p: Partial<QueueParams>) => setParams((cur) => ({ ...cur, page: 1, ...p }));
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    patch({ q: search });
  };

  const columns: Column<QueueItem>[] = [
    {
      key: "land_id",
      header: t("cols.land"),
      sortable: true,
      render: (r) => (
        <Link
          href={`/officer/review/${r.id}`}
          className="font-medium text-primary underline"
          aria-label={t("openRow", { name: r.land_id ?? t("noLand") })}
        >
          {r.land_id ?? t("noLand")}
        </Link>
      ),
    },
    { key: "document_type", header: t("cols.type"), render: (r) => (["DEED", "KHATIAN", "PORCHA", "MUTATION", "OTHER"].includes(r.document_type) ? tt(r.document_type) : r.document_type) },
    { key: "status", header: t("cols.status"), sortable: true, render: (r) => <StatusBadge code={r.processing_status} /> },
    {
      key: "confidence",
      header: t("cols.confidence"),
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {r.min_confidence === null ? t("noConfidence") : `${Math.round(r.min_confidence * 100)}%`}
          {r.low_confidence && <Badge tone="review">{t("lowConfidence")}</Badge>}
        </span>
      ),
    },
    { key: "risk", header: t("cols.risk"), render: (r) => (r.high_risk ? <RiskBadge level="HIGH" /> : <span className="text-ink-muted">—</span>) },
    { key: "created_at", header: t("cols.created"), sortable: true, render: (r) => formatDateTime(r.created_at, locale, "—") },
  ];

  return (
    <Card title={t("title")} icon={<ListChecks />} accent="primary">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            label={t("filter.label")}
            value={params.filter}
            onChange={(e) => patch({ filter: e.target.value as QueueParams["filter"] })}
            placeholder={t("filter.all")}
            options={QUEUE_FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`) }))}
          />
          <form onSubmit={onSearch} role="search" className="flex flex-1 items-end gap-2">
            <div className="flex-1">
              <Input label={t("search.label")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search.placeholder")} />
            </div>
            <Button type="submit" variant="primary" icon={<Search />}>{t("search.submit")}</Button>
          </form>
        </div>

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState
            message={q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined}
            onRetry={() => q.refetch()}
          />
        ) : (
          <div aria-busy={q.isFetching} data-testid="queue-table">
            <Table
              caption={t("title")}
              columns={columns}
              rows={q.data.items}
              rowKey={(r) => r.id}
              sort={{ key: params.sort, dir: params.order }}
              onSortChange={(s) => {
                const key = s.key as QueueSortKey;
                if (SORT_KEYS.includes(key)) patch({ sort: key, order: s.dir });
              }}
              page={params.page}
              pageSize={PAGE_SIZE}
              total={q.data.total}
              onPageChange={(page) => setParams((cur) => ({ ...cur, page }))}
              emptyText={t("empty")}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
