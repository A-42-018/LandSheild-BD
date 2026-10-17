"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileCheck2, Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import StatusBadge from "@/components/domain/StatusBadge";
import { Badge, Card, ErrorState, LoadingState, Table, Tabs, type Column } from "@/components/ui";
import { formatArea, formatDate } from "@/features/result/format";
import AreaFilter, { NO_AREA, type Area } from "@/features/officers/AreaFilter";
import { useMutationQueue } from "./useMutations";
import { daysSince, MUTATION_STATUSES, PAGE_SIZE, type MutationQueueItem } from "./types";

export default function MutationQueue() {
  const t = useTranslations("mutation");
  const tRes = useTranslations("result");
  const locale = useLocale();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [area, setArea] = useState<Area>(NO_AREA);
  const q = useMutationQueue(status, page, area);
  const unit = (u: string) => (tRes.has(`units.${u}`) ? tRes(`units.${u}`) : u);

  const columns: Column<MutationQueueItem>[] = [
    {
      key: "mutation_no",
      header: t("cols.no"),
      render: (r) => (
        <Link href={`/officer/mutations/${r.id}`} className="font-medium text-primary underline" aria-label={t("openRow", { no: r.mutation_no })}>
          {r.mutation_no}
        </Link>
      ),
    },
    { key: "land_id", header: t("cols.land"), render: (r) => <span className="font-mono">{r.land_id}</span> },
    { key: "applicant", header: t("cols.applicant") },
    {
      key: "status",
      header: t("cols.status"),
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge code={r.status} />
          {r.fast_track && <Badge tone="verified" icon={<Zap />}>{t("fastTrack")}</Badge>}
        </span>
      ),
    },
    { key: "area", header: t("cols.area"), render: (r) => formatArea(r.area, r.area_unit, locale, unit(r.area_unit)) },
    {
      key: "days",
      header: t("cols.days"),
      render: (r) => (r.decided_at ? "—" : t("days", { count: daysSince(r.status_changed_at) })),
    },
    { key: "applied_at", header: t("cols.applied"), render: (r) => formatDate(r.applied_at, locale, "—") },
  ];

  const content = q.isLoading ? (
    <LoadingState />
  ) : q.isError || !q.data ? (
    <ErrorState error={q.error} onRetry={() => q.refetch()} />
  ) : (
    <div aria-busy={q.isFetching} data-testid="mutation-queue">
      <Table
        caption={t("title")}
        columns={columns}
        rows={q.data.items}
        rowKey={(r) => r.id}
        page={page}
        pageSize={PAGE_SIZE}
        total={q.data.total}
        onPageChange={setPage}
        emptyText={t("empty")}
      />
    </div>
  );

  const tabs = ["", ...MUTATION_STATUSES].map((s) => ({
    id: s || "ALL",
    label: s ? t(`tabs.${s}`) : t("tabs.ALL"),
    content: content,
  }));

  return (
    <div className="flex flex-col gap-4">
    <OfficerPageHeader title={t("title")} purpose={t("purpose")} />
    <Card icon={<FileCheck2 />} accent="primary">
      <div className="mb-4">
        <AreaFilter value={area} onChange={(a) => { setArea(a); setPage(1); }} />
      </div>
      <Tabs
        tabs={tabs}
        value={status || "ALL"}
        onValueChange={(id) => {
          setStatus(id === "ALL" ? "" : id);
          setPage(1);
        }}
        label={t("tabsLabel")}
      />
    </Card>
    </div>
  );
}
