"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Landmark, RotateCcw, Search } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button, Card, ErrorState, Input, LoadingState, Select, Table, type Column, type SortState } from "@/components/ui";
import { formatDateTime } from "@/features/result/format";
import {
  ADMIN_PAGE_SIZE, DOC_STATUSES, DOC_TYPES, LAND_STATUSES, type AdminDocument, type AdminLandRecord, type ListParams,
} from "./types";
import { useAdminDocuments, useAdminLandRecords } from "./useAdmin";
import { intlLocale } from "@/lib/intl-locale";

function Filters({
  label, draft, setDraft, apply, reset, statuses, statusLabel,
}: {
  label: string;
  draft: ListParams;
  setDraft: (p: ListParams) => void;
  apply: (e: FormEvent) => void;
  reset: () => void;
  statuses: string[];
  statusLabel: (s: string) => string;
}) {
  const tc = useTranslations("admin.console");
  return (
    <form
      onSubmit={apply}
      role="search"
      aria-label={label}
      className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface-muted p-3 sm:grid-cols-3"
    >
      <Input label={tc("search")} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
      <Select
        label={tc("status")}
        value={draft.filter}
        onChange={(e) => setDraft({ ...draft, filter: e.target.value })}
        placeholder={tc("all")}
        options={statuses.map((s) => ({ value: s, label: statusLabel(s) }))}
      />
      <div className="flex items-end gap-2">
        <Button type="submit" icon={<Search />}>{tc("apply")}</Button>
        <Button type="button" variant="secondary" icon={<RotateCcw />} onClick={reset}>{tc("reset")}</Button>
      </div>
    </form>
  );
}

function useListState(sort: string, order: "asc" | "desc") {
  const initial: ListParams = { q: "", filter: "", active: "", sort, order, page: 1 };
  const [params, setParams] = useState(initial);
  const [draft, setDraft] = useState(initial);
  return {
    params, setParams, draft, setDraft,
    apply: (e: FormEvent) => { e.preventDefault(); setParams({ ...draft, sort: params.sort, order: params.order, page: 1 }); },
    reset: () => { setDraft(initial); setParams(initial); },
  };
}

export function LandRecordsPanel() {
  const t = useTranslations("admin.console.records");
  const ts = useTranslations("status");
  const te = useTranslations("admin.console.errors");
  const locale = useLocale();
  const s = useListState("land_id", "asc");
  const q = useAdminLandRecords(s.params);
  const num = new Intl.NumberFormat(intlLocale(locale));

  const columns: Column<AdminLandRecord>[] = [
    { key: "land_id", header: t("cols.landId"), sortable: true },
    { key: "district", header: t("cols.district"), sortable: true },
    { key: "upazila", header: t("cols.upazila") },
    { key: "mouza", header: t("cols.mouza"), sortable: true },
    { key: "khatian_no", header: t("cols.khatian") },
    { key: "dag_no", header: t("cols.dag") },
    { key: "area", header: t("cols.area"), sortable: true, render: (r) => `${num.format(r.area)} ${r.area_unit}` },
    { key: "status", header: t("cols.status"), sortable: true, render: (r) => (LAND_STATUSES.includes(r.status) ? ts(r.status) : r.status) },
    { key: "updated_at", header: t("cols.updated"), sortable: true, render: (r) => formatDateTime(r.updated_at, locale, "—") },
  ];
  const sort: SortState = { key: s.params.sort, dir: s.params.order };

  return (
    <Card title={t("title")} icon={<Landmark />} accent="primary">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{t("hint")}</p>
        <Filters label={t("filters")} draft={s.draft} setDraft={s.setDraft} apply={s.apply} reset={s.reset} statuses={LAND_STATUSES} statusLabel={(x) => ts(x)} />
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState message={q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined} onRetry={() => q.refetch()} />
        ) : (
          <div aria-busy={q.isFetching} data-testid="records-table">
            <Table
              caption={t("title")}
              columns={columns}
              rows={q.data.items}
              rowKey={(r) => r.land_id}
              sort={sort}
              onSortChange={(x) => s.setParams((c) => ({ ...c, sort: x.key, order: x.dir, page: 1 }))}
              page={s.params.page}
              pageSize={ADMIN_PAGE_SIZE}
              total={q.data.total}
              onPageChange={(page) => s.setParams((c) => ({ ...c, page }))}
              emptyText={t("empty")}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export function DocumentsPanel() {
  const t = useTranslations("admin.console.documents");
  const ts = useTranslations("status");
  const tu = useTranslations("upload.types");
  const te = useTranslations("admin.console.errors");
  const locale = useLocale();
  const s = useListState("created_at", "desc");
  const q = useAdminDocuments(s.params);

  const columns: Column<AdminDocument>[] = [
    { key: "land_id", header: t("cols.landId"), sortable: true, render: (d) => d.land_id ?? <span className="text-ink-muted">{t("unassigned")}</span> },
    { key: "document_type", header: t("cols.type"), sortable: true, render: (d) => (DOC_TYPES.includes(d.document_type) ? tu(d.document_type) : d.document_type) },
    { key: "processing_status", header: t("cols.status"), sortable: true, render: (d) => (DOC_STATUSES.includes(d.processing_status) ? ts(d.processing_status) : d.processing_status) },
    { key: "ocr_confidence", header: t("cols.confidence"), sortable: true, render: (d) => (d.ocr_confidence == null ? "—" : `${Math.round(d.ocr_confidence * 100)}%`) },
    { key: "uploaded_by", header: t("cols.uploader"), render: (d) => d.uploaded_by ?? "—" },
    { key: "created_at", header: t("cols.created"), sortable: true, render: (d) => formatDateTime(d.created_at, locale, "—") },
  ];
  const sort: SortState = { key: s.params.sort, dir: s.params.order };

  return (
    <Card title={t("title")} icon={<FileText />} accent="primary">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{t("hint")}</p>
        <Filters label={t("filters")} draft={s.draft} setDraft={s.setDraft} apply={s.apply} reset={s.reset} statuses={DOC_STATUSES} statusLabel={(x) => ts(x)} />
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState message={q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined} onRetry={() => q.refetch()} />
        ) : (
          <div aria-busy={q.isFetching} data-testid="documents-table">
            <Table
              caption={t("title")}
              columns={columns}
              rows={q.data.items}
              rowKey={(d) => d.id}
              sort={sort}
              onSortChange={(x) => s.setParams((c) => ({ ...c, sort: x.key, order: x.dir, page: 1 }))}
              page={s.params.page}
              pageSize={ADMIN_PAGE_SIZE}
              total={q.data.total}
              onPageChange={(page) => s.setParams((c) => ({ ...c, page }))}
              emptyText={t("empty")}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
