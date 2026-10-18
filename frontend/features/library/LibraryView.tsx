"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FileImage, FileText, FolderOpen, RotateCcw, Search } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import StatusBadge from "@/components/domain/StatusBadge";
import { Badge, Button, Card, ErrorState, Input, LoadingState, Select, Table, Tabs, type Column } from "@/components/ui";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import AreaFilter from "@/features/officers/AreaFilter";
import { formatDate, formatDateTime } from "@/features/result/format";
import {
  DEFAULT_PARAMS, LIBRARY_PAGE_SIZE, LIBRARY_SORTS, LIBRARY_STATUSES, LIBRARY_TABS, LIBRARY_TYPES,
  documentHref, type LibraryItem, type LibraryParams, type LibrarySortKey,
} from "./types";
import { paramsFromUrl, paramsToUrl, useLibrary } from "./useLibrary";
import DownloadMenu from "./DownloadMenu";

export function FileIcon({ type }: { type: string }) {
  const Icon = type === "pdf" ? FileText : FileImage;
  return <span aria-hidden="true" className="icon-tile !h-8 !w-8 !rounded-lg"><Icon className="h-4 w-4" /></span>;
}

export default function LibraryView() {
  const t = useTranslations("library");
  const tt = useTranslations("upload.types");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const params = paramsFromUrl(sp);
  const [search, setSearch] = useState(params.q);
  const q = useLibrary(params);

  const go = (next: LibraryParams) => {
    const qs = paramsToUrl(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };
  const patch = (p: Partial<LibraryParams>) => go({ ...params, page: 1, ...p });
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    patch({ q: search });
  };
  const reset = () => {
    setSearch("");
    go({ ...DEFAULT_PARAMS, tab: params.tab });
  };

  const columns: Column<LibraryItem>[] = [
    { key: "file", header: t("cols.file"), render: (r) => <span title={r.file_type.toUpperCase()}><FileIcon type={r.file_type} /><span className="sr-only">{r.file_type.toUpperCase()}</span></span> },
    {
      key: "deed_no",
      header: t("cols.deedNo"),
      render: (r) => (
        <Link href={documentHref(r)} className="font-medium text-primary underline" aria-label={t("openRow", { name: r.deed_no ?? r.land_id ?? t("noNumber") })}>
          {r.deed_no ?? r.land_id ?? t("noNumber")}
        </Link>
      ),
    },
    { key: "mouza", header: t("cols.mouza"), render: (r) => r.mouza ?? "—" },
    {
      key: "type",
      header: t("cols.type"),
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {(LIBRARY_TYPES as readonly string[]).includes(r.document_type) ? tt(r.document_type) : r.document_type}
          {r.historical && <Badge tone="review">{t("historical")}</Badge>}
        </span>
      ),
    },
    { key: "deed_date", header: t("cols.deedDate"), sortable: true, render: (r) => (r.deed_date ? formatDate(r.deed_date, locale, "—") : "—") },
    {
      key: "status",
      header: t("cols.status"),
      sortable: true,
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge code={r.processing_status} />
          {r.needs_my_action && <Badge tone="pending">{t("needsAction")}</Badge>}
        </span>
      ),
    },
    { key: "created_at", header: t("cols.uploaded"), sortable: true, render: (r) => formatDateTime(r.created_at, locale, "—") },
    {
      key: "digitised",
      header: t("cols.digitised"),
      render: (r) =>
        r.digitised ? (
          <Badge tone="verified">{t("digitisedYes", { version: r.approved_version ?? 0 })}</Badge>
        ) : (
          <span className="text-ink-muted">{t("digitisedNo")}</span>
        ),
    },
    {
      key: "download",
      header: t("cols.download"),
      render: (r) => (
        <DownloadMenu
          compact
          documentId={r.id}
          fileType={r.file_type}
          version={r.approved_version}
          draft={!r.digitised}
          hasRecord={r.versions > 0}
        />
      ),
    },
  ];

  const table = (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSearch} role="search" aria-label={t("filters")} className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input label={t("search.label")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search.placeholder")} />
          </div>
          <Button type="submit" icon={<Search />}>{t("search.submit")}</Button>
          <Button type="button" variant="secondary" icon={<RotateCcw />} onClick={reset}>{t("reset")}</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label={t("filter.status")} value={params.status} placeholder={t("filter.all")} onChange={(e) => patch({ status: e.target.value })}
            options={LIBRARY_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
          <Select label={t("filter.type")} value={params.type} placeholder={t("filter.all")} onChange={(e) => patch({ type: e.target.value })}
            options={LIBRARY_TYPES.map((s) => ({ value: s, label: tt(s) }))} />
          <Select label={t("filter.profile")} value={params.profile} placeholder={t("filter.all")}
            onChange={(e) => patch({ profile: e.target.value as LibraryParams["profile"] })}
            options={[{ value: "modern", label: t("profiles.modern") }, { value: "historical", label: t("profiles.historical") }]} />
          <Select label={t("filter.sort")} value={params.sort} onChange={(e) => patch({ sort: e.target.value as LibrarySortKey })}
            options={LIBRARY_SORTS.map((s) => ({ value: s, label: t(`sorts.${s}`) }))} />
          <Input type="date" label={t("filter.from")} value={params.date_from} max={params.date_to || undefined} onChange={(e) => patch({ date_from: e.target.value })} />
          <Input type="date" label={t("filter.to")} value={params.date_to} min={params.date_from || undefined} onChange={(e) => patch({ date_to: e.target.value })} />
        </div>
        <AreaFilter
          value={{ division: params.division, district: params.district, upazila: params.upazila }}
          onChange={(a) => patch({ division: a.division, district: a.district, upazila: a.upazila })}
        />
      </form>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div aria-busy={q.isFetching} data-testid="library-table">
          <Table
            caption={t(`tabs.${params.tab}`)}
            columns={columns}
            rows={q.data.items}
            rowKey={(r) => r.id}
            sort={{ key: params.sort, dir: params.order }}
            onSortChange={(s) => {
              const key = s.key as LibrarySortKey;
              if (LIBRARY_SORTS.includes(key)) patch({ sort: key, order: s.dir });
            }}
            page={params.page}
            pageSize={LIBRARY_PAGE_SIZE}
            total={q.data.total}
            onPageChange={(page) => go({ ...params, page })}
            emptyText={t(`empty.${params.tab}`)}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("title")} purpose={t("purpose")} />
      <Card icon={<FolderOpen />} accent="primary">
        <Tabs
          label={t("tabsLabel")}
          value={params.tab}
          onValueChange={(id) => patch({ tab: id as LibraryParams["tab"] })}
          tabs={LIBRARY_TABS.map((id) => ({ id, label: t(`tabs.${id}`), content: id === params.tab ? table : null }))}
        />
      </Card>
    </div>
  );
}
