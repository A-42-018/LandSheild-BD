"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input, Select, Table, type Column, type SortState } from "@/components/ui";
import { gisLabel, type MouzaDto } from "@/features/map/gis/types";
import SheetChip, { useSheetLabel } from "./SheetChip";
import {
  copyNumbers,
  DEFAULT_SORT,
  filterMouzas,
  MOUZA_PAGE_SIZE,
  parseSort,
  SORT_OPTIONS,
  sortMouzas,
  sortOption,
  surveysOf,
  visibleSheets,
  type MouzaFilters,
} from "./types";

/** Sheets listed in the table cell; longer lists end with "+N more" (the details dialog has them all). */
const INLINE_SHEETS = 4;

export interface MouzaListProps {
  mouzas: MouzaDto[];
  unionName: (id: string | null | undefined) => string | undefined;
  onOpen: (id: string) => void;
}

export default function MouzaList({ mouzas, unionName, onOpen }: MouzaListProps) {
  const t = useTranslations("mouza");
  const locale = useLocale();
  const label = useSheetLabel();
  const [filters, setFilters] = useState<MouzaFilters>({ q: "", survey: "", scannedOnly: false });
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  const surveys = useMemo(() => surveysOf(mouzas), [mouzas]);
  // a survey the current list does not have (union changed) counts as "all surveys"
  const survey = surveys.some((s) => s.survey === filters.survey) ? filters.survey : "";
  const rows = useMemo(
    () => sortMouzas(filterMouzas(mouzas, { ...filters, survey }), sort, locale, survey),
    [mouzas, filters, survey, sort, locale],
  );
  const pages = Math.max(1, Math.ceil(rows.length / MOUZA_PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * MOUZA_PAGE_SIZE, current * MOUZA_PAGE_SIZE);
  const scans = rows.reduce((n, m) => n + visibleSheets(m, survey).filter((s) => s.url).length, 0);

  const update = (next: Partial<MouzaFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  };
  const changeSort = (next: SortState) => {
    setSort(next);
    setPage(1);
  };

  const columns: Column<MouzaDto>[] = [
    { key: "jl", header: t("cols.jl"), sortable: true, className: "whitespace-nowrap tabular-nums", render: (m) => m.jl_no ?? "—" },
    {
      key: "name",
      header: t("cols.name"),
      sortable: true,
      render: (m) => (
        <>
          <button
            type="button"
            onClick={() => onOpen(m.id)}
            title={t("detailsFor", { name: gisLabel(m) })}
            className="text-left font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {gisLabel(m)}
          </button>
          {/* the Union column is hidden on phones; its value moves under the name */}
          <p className="mt-0.5 text-xs text-ink-muted sm:hidden">{unionName(m.union_id) ?? t("unionUnknown")}</p>
        </>
      ),
    },
    {
      key: "union",
      header: t("cols.union"),
      className: "hidden sm:table-cell",
      render: (m) => unionName(m.union_id) ?? <span className="text-ink-muted">{t("unionUnknown")}</span>,
    },
    {
      key: "sheets",
      header: t("cols.sheets"),
      sortable: true,
      render: (m) => {
        const sheets = visibleSheets(m, survey);
        if (sheets.length === 0) return <span className="text-ink-muted">—</span>;
        const copies = copyNumbers(sheets);
        const inline = sheets.length > INLINE_SHEETS ? sheets.slice(0, INLINE_SHEETS - 1) : sheets;
        return (
          <ul className="flex flex-wrap items-center gap-1.5">
            {inline.map((s, i) => (
              <li key={`${s.survey ?? ""}-${s.sheet_no}-${i}`}>
                <SheetChip sheet={s} mouza={m} copy={copies[i]} />
              </li>
            ))}
            {inline.length < sheets.length && (
              <li>
                <button
                  type="button"
                  onClick={() => onOpen(m.id)}
                  className="rounded-md px-1.5 py-0.5 text-xs font-medium text-link underline underline-offset-2 hover:bg-primary-soft"
                >
                  {t("moreSheets", { count: sheets.length - inline.length })}
                </button>
              </li>
            )}
          </ul>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface-muted p-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label={t("filterLabel")}
          type="search"
          value={filters.q}
          placeholder={t("filterPlaceholder")}
          onChange={(e) => update({ q: e.target.value })}
        />
        <Select
          label={t("survey")}
          placeholder={t("allSurveys")}
          value={survey}
          options={surveys.map((s) => ({
            value: s.survey,
            label: `${label.survey(s.survey)} · ${t("mouzaCount", { count: s.mouzas })}`,
          }))}
          disabled={surveys.length === 0}
          onChange={(e) => update({ survey: e.target.value })}
        />
        <Select
          label={t("sort")}
          value={sortOption(sort)}
          options={SORT_OPTIONS.map((o) => ({ value: o, label: t(`sortOptions.${o}`) }))}
          onChange={(e) => changeSort(parseSort(e.target.value))}
        />
        <label className="flex min-h-11 items-center gap-2 self-end text-sm text-ink">
          <input
            type="checkbox"
            checked={filters.scannedOnly}
            onChange={(e) => update({ scannedOnly: e.target.checked })}
          />
          {t("scannedOnly")}
        </label>
      </div>
      <p role="status" className="text-sm text-ink-muted">
        {t("count", { shown: rows.length, total: mouzas.length })} · {t("scanCount", { count: scans })}
      </p>
      <div data-testid="mouza-table">
        <Table
          compact
          caption={t("listTitle")}
          columns={columns}
          rows={shown}
          rowKey={(m) => m.id}
          sort={sort}
          onSortChange={changeSort}
          page={current}
          pageSize={MOUZA_PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
          emptyText={t("noMatch")}
        />
      </div>
    </div>
  );
}
