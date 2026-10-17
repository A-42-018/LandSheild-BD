"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Building2, RotateCcw, Search } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button, Card, ErrorState, Input, LoadingState, Select, Table, type Column } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { intlLocale } from "@/lib/intl-locale";
import { bi, OFFICE_TYPES, officePath } from "@/features/officers/types";
import { ADMIN_PAGE_SIZE, type AdminOffice, type Paged } from "./types";

export default function OfficesPanel() {
  const t = useTranslations("admin.console.offices");
  const tc = useTranslations("admin.console");
  const te = useTranslations("admin.console.errors");
  const locale = useLocale();
  const { api } = useAuth();
  const [draft, setDraft] = useState({ q: "", type: "" });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);

  const q = useQuery<Paged<AdminOffice>, ApiError>({
    queryKey: ["admin", "offices", applied, page],
    queryFn: () => {
      const s = new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE), offset: String((page - 1) * ADMIN_PAGE_SIZE) });
      if (applied.q.trim()) s.set("q", applied.q.trim());
      if (applied.type) s.set("office_type", applied.type);
      return api.get(`/admin/offices?${s}`);
    },
    placeholderData: keepPreviousData,
  });
  const num = new Intl.NumberFormat(intlLocale(locale));
  const apply = (e: FormEvent) => { e.preventDefault(); setApplied(draft); setPage(1); };
  const reset = () => { const z = { q: "", type: "" }; setDraft(z); setApplied(z); setPage(1); };

  const columns: Column<AdminOffice>[] = [
    { key: "name", header: t("cols.name"), render: (o) => bi(o.name_en, o.name_bn) },
    { key: "type", header: t("cols.type"), render: (o) => o.office_type },
    { key: "place", header: t("cols.place"), render: (o) => officePath(o) },
    { key: "code", header: t("cols.code"), className: "whitespace-nowrap" },
    { key: "officers", header: t("cols.officers"), className: "text-end", render: (o) => num.format(o.officers) },
  ];

  return (
    <Card title={t("title")} icon={<Building2 />} accent="primary">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{t("hint")}</p>
        <form onSubmit={apply} role="search" aria-label={t("filters")} className="glass-card grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label={tc("search")} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          <Select label={t("cols.type")} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} placeholder={tc("all")} options={OFFICE_TYPES.map((x) => ({ value: x, label: x }))} />
          <div className="flex items-end gap-2">
            <Button type="submit" icon={<Search />}>{tc("apply")}</Button>
            <Button type="button" variant="secondary" icon={<RotateCcw />} onClick={reset}>{tc("reset")}</Button>
          </div>
        </form>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState message={q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined} onRetry={() => q.refetch()} />
        ) : (
          <div aria-busy={q.isFetching} data-testid="offices-table">
            <Table caption={t("title")} columns={columns} rows={q.data.items} rowKey={(o) => o.id} page={page} pageSize={ADMIN_PAGE_SIZE} total={q.data.total} onPageChange={setPage} emptyText={t("empty")} />
          </div>
        )}
      </div>
    </Card>
  );
}
