"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Archive, RotateCcw, Search } from "lucide-react";
import { ApiError } from "@/lib/api";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import { Button, Card, ErrorState, Input, LoadingState, Select, Table, type Column } from "@/components/ui";
import { ARCHIVE_PAGE_SIZE, SURVEYS, type ArchiveHit, type ArchiveParams } from "./types";
import { useArchive } from "./useArchive";

const INITIAL: ArchiveParams = { q: "", survey: "", district: "", page: 1 };

/** The backend wraps matched words in [ ]; render them as <mark> without any raw HTML. */
export function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]*\])/g).filter(Boolean);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith("[") && p.endsWith("]") ? <mark key={i} className="bg-primary-soft text-ink">{p.slice(1, -1)}</mark> : p,
      )}
    </span>
  );
}

export default function ArchiveSearch() {
  const t = useTranslations("archive");
  const te = useTranslations("errors");
  const [params, setParams] = useState<ArchiveParams>(INITIAL);
  const [draft, setDraft] = useState<ArchiveParams>(INITIAL);
  const q = useArchive(params);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    if (draft.q.trim()) setParams({ ...draft, page: 1 });
  };
  const reset = () => {
    setDraft(INITIAL);
    setParams(INITIAL);
  };

  const columns: Column<ArchiveHit>[] = [
    { key: "survey", header: t("cols.survey"), render: (r) => (r.survey_type ? t(`surveys.${r.survey_type}`) : "—") },
    { key: "land", header: t("cols.land"), render: (r) => (r.land_id ? <code className="font-mono text-xs">{r.land_id}</code> : "—") },
    {
      key: "place",
      header: t("cols.place"),
      render: (r) => [r.district, r.upazila, r.mouza].filter(Boolean).join(" · ") || "—",
    },
    { key: "khatian", header: t("cols.khatian"), render: (r) => r.khatian_no ?? "—" },
    { key: "snippet", header: t("cols.excerpt"), render: (r) => <Snippet text={r.snippet} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("title")} purpose={t("purpose")} />
      <Card icon={<Archive />} accent="primary">
        <div className="flex flex-col gap-4">
          <form
            onSubmit={apply}
            role="search"
            aria-label={t("filters")}
            className="grid grid-cols-1 gap-3 glass-card p-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Input label={t("query")} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} required />
            <Select
              label={t("survey")}
              value={draft.survey}
              onChange={(e) => setDraft({ ...draft, survey: e.target.value })}
              placeholder={t("all")}
              options={SURVEYS.map((s) => ({ value: s, label: t(`surveys.${s}`) }))}
            />
            <Input label={t("district")} value={draft.district} onChange={(e) => setDraft({ ...draft, district: e.target.value })} />
            <div className="flex items-end gap-2">
              <Button type="submit" icon={<Search />} disabled={!draft.q.trim()}>{t("search")}</Button>
              <Button type="button" variant="secondary" icon={<RotateCcw />} onClick={reset}>{t("reset")}</Button>
            </div>
          </form>
          {!params.q ? (
            <p className="text-sm text-ink-muted">{t("hint")}</p>
          ) : q.isLoading ? (
            <LoadingState />
          ) : q.isError || !q.data ? (
            <ErrorState
              message={q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined}
              onRetry={() => q.refetch()}
            />
          ) : (
            <div aria-busy={q.isFetching} data-testid="archive-table">
              <Table
                caption={t("results")}
                columns={columns}
                rows={q.data.items}
                rowKey={(r) => r.document_id}
                page={params.page}
                pageSize={ARCHIVE_PAGE_SIZE}
                total={q.data.total}
                onPageChange={(page) => setParams((cur) => ({ ...cur, page }))}
                emptyText={t("empty")}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
