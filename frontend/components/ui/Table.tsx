"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import Button from "./Button";
import EmptyState from "./EmptyState";
import { cn } from "./cn";

export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  page?: number; // 1-based
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  emptyText?: string;
  /** Keep the header visible while the body scrolls (adds a 70vh max height). Off by default. */
  stickyHeader?: boolean;
}

export default function Table<T>({
  columns, rows, rowKey, caption, sort, onSortChange, page, pageSize, total, onPageChange, emptyText, stickyHeader = false,
}: TableProps<T>) {
  const t = useTranslations("table");
  const paged = page !== undefined && pageSize !== undefined && total !== undefined && onPageChange;
  const pages = paged ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  const toggle = (key: string) =>
    onSortChange?.({ key, dir: sort?.key === key && sort.dir === "asc" ? "desc" : "asc" });

  if (rows.length === 0) return <EmptyState title={emptyText} />;

  return (
    <div>
      <div className={cn("overflow-x-auto rounded-xl border border-line bg-surface shadow-card", stickyHeader && "max-h-[70vh] overflow-y-auto")}>
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className={cn("bg-primary-soft text-ink", stickyHeader && "sticky top-0 z-10")}>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={c.sortable ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                    className={cn("px-3 py-2.5 font-semibold", c.className)}
                  >
                    {c.sortable ? (
                      <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 font-semibold">
                        {c.header}
                        <span aria-hidden="true" className="inline-flex">
                          {active ? (
                            sort!.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
                          )}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-line even:bg-surface-muted/60 hover:bg-primary-soft/50">
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2 text-ink", c.className)}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paged && (
        <nav aria-label={t("pagination")} className="mt-3 flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {t("previous")}
          </Button>
          <span className="text-sm text-ink-muted">{t("pageOf", { page, total: pages })}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            {t("next")}
          </Button>
        </nav>
      )}
    </div>
  );
}
