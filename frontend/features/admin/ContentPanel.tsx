"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, ErrorState, Input, LoadingState, Modal, Table, Tabs, type Column } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDate } from "@/features/result/format";
import { CONTENT_KINDS, pick, type AdminContent, type ContentKind } from "@/features/content/content";
import { ADMIN_PAGE_SIZE, type Paged } from "./types";

interface Draft {
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  published_on: string;
  ticker: boolean;
  published: boolean;
  position: string;
}
const EMPTY: Draft = { title_en: "", title_bn: "", body_en: "", body_bn: "", published_on: "", ticker: false, published: true, position: "0" };
const AREA = "rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

const toDraft = (c: AdminContent): Draft => ({
  title_en: c.title_en, title_bn: c.title_bn, body_en: c.body_en, body_bn: c.body_bn,
  published_on: c.published_on ?? "", ticker: c.ticker, published: c.published, position: String(c.position),
});

function errorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return "permission";
    if (e.status === 422) return "invalid";
  }
  return "generic";
}

/** Admin content management (U3.6): notices, FAQ entries and guides in both languages. Only published items reach the public pages. */
export default function ContentPanel() {
  const t = useTranslations("admin.console.content");
  const tc = useTranslations("admin.console");
  const te = useTranslations("admin.console.errors");
  const locale = useLocale();
  const { api } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState<ContentKind>("NOTICE");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [removing, setRemoving] = useState<AdminContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery<Paged<AdminContent>, ApiError>({
    queryKey: ["admin", "content", kind, page],
    queryFn: () => api.get(`/admin/content?kind=${kind}&limit=${ADMIN_PAGE_SIZE}&offset=${(page - 1) * ADMIN_PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  });
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "content"] });
  const save = useMutation<AdminContent, ApiError, { id: string | null; draft: Draft }>({
    mutationFn: ({ id, draft }) => {
      const body = {
        title_en: draft.title_en.trim(), title_bn: draft.title_bn.trim(), body_en: draft.body_en.trim(), body_bn: draft.body_bn.trim(),
        published: draft.published, position: Number(draft.position) || 0,
        ...(kind === "NOTICE" ? { published_on: draft.published_on || null, ticker: draft.ticker } : {}),
      };
      return id ? api.patch(`/admin/content/${id}`, body) : api.post("/admin/content", { kind, ...body });
    },
    onSuccess: () => { setForm(null); void done(); },
    onError: (e) => setError(errorKey(e)),
  });
  const remove = useMutation<void, ApiError, string>({
    mutationFn: (id) => api.del(`/admin/content/${id}`),
    onSuccess: () => { setRemoving(null); void done(); },
    onError: (e) => { setRemoving(null); setError(errorKey(e)); },
  });

  const open = (id: string | null, draft: Draft) => { setError(null); setForm({ id, draft }); };
  const set = (patch: Partial<Draft>) => setForm((f) => f && { ...f, draft: { ...f.draft, ...patch } });
  const submit = (e: FormEvent) => { e.preventDefault(); if (form) save.mutate(form); };
  const d = form?.draft;
  const valid = !!d && [d.title_en, d.title_bn, d.body_en, d.body_bn].every((x) => x.trim().length >= 3) && (kind !== "NOTICE" || !!d.published_on);

  const columns: Column<AdminContent>[] = [
    { key: "title", header: t("cols.title"), render: (c) => <span lang={locale}>{pick(c, locale, "title")}</span> },
    ...(kind === "NOTICE"
      ? [{ key: "date", header: t("cols.date"), className: "whitespace-nowrap", render: (c: AdminContent) => (c.published_on ? formatDate(c.published_on, locale, "—") : "—") }]
      : [{ key: "position", header: t("cols.position"), className: "text-end", render: (c: AdminContent) => c.position }]),
    {
      key: "status", header: t("cols.status"),
      render: (c) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone={c.published ? "verified" : "pending"} dot>{c.published ? t("published") : t("draft")}</Badge>
          {c.ticker && <Badge tone="review">{t("inTicker")}</Badge>}
        </span>
      ),
    },
    {
      key: "actions", header: t("cols.actions"), className: "text-end",
      render: (c) => (
        <span className="inline-flex gap-1">
          <Button size="sm" variant="secondary" icon={<Pencil />} aria-label={t("editAria", { title: pick(c, locale, "title") })} onClick={() => open(c.id, toDraft(c))}>{t("edit")}</Button>
          <Button size="sm" variant="danger" icon={<Trash2 />} aria-label={t("deleteAria", { title: pick(c, locale, "title") })} onClick={() => { setError(null); setRemoving(c); }}>{t("delete")}</Button>
        </span>
      ),
    },
  ];

  return (
    <Card title={t("title")} icon={<FileText />} accent="primary">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-ink-muted">{t("hint")}</p>
          <Button icon={<Plus />} onClick={() => open(null, EMPTY)}>{t("add")}</Button>
        </div>
        <Tabs
          label={t("kindsLabel")}
          variant="segmented"
          value={kind}
          onValueChange={(k) => { setKind(k as ContentKind); setPage(1); }}
          tabs={CONTENT_KINDS.map((k) => ({ id: k, label: t(`kinds.${k}`), content: null }))}
        />
        <p className="text-xs text-ink-muted">{t(`kindHint.${kind}`)}</p>
        {error && !form && <p role="alert" className="rounded-lg border border-critical/30 bg-critical-soft p-3 text-sm text-critical">{te(error)}</p>}
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <div aria-busy={q.isFetching} data-testid="content-table">
            <Table caption={t(`kinds.${kind}`)} columns={columns} rows={q.data.items} rowKey={(c) => c.id} page={page} pageSize={ADMIN_PAGE_SIZE} total={q.data.total} onPageChange={setPage} emptyText={t("empty")} />
          </div>
        )}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? t("editTitle") : t("addTitle", { kind: t(`kinds.${kind}`) })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>{tc("cancel")}</Button>
            <Button type="submit" form="content-form" loading={save.isPending} disabled={!valid}>{tc("save")}</Button>
          </>
        }
      >
        {d && (
          <form id="content-form" onSubmit={submit} className="flex flex-col gap-3">
            <Input label={t("fields.titleBn")} lang="bn" required maxLength={200} value={d.title_bn} onChange={(e) => set({ title_bn: e.target.value })} />
            <Input label={t("fields.titleEn")} lang="en" required maxLength={200} value={d.title_en} onChange={(e) => set({ title_en: e.target.value })} />
            <div className="flex flex-col gap-1">
              <label htmlFor="content-body-bn" className="text-sm font-medium text-ink">{t("fields.bodyBn")} <span aria-hidden="true" className="text-critical">*</span></label>
              <textarea id="content-body-bn" lang="bn" rows={4} required maxLength={5000} value={d.body_bn} onChange={(e) => set({ body_bn: e.target.value })} className={AREA} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="content-body-en" className="text-sm font-medium text-ink">{t("fields.bodyEn")} <span aria-hidden="true" className="text-critical">*</span></label>
              <textarea id="content-body-en" lang="en" rows={4} required maxLength={5000} value={d.body_en} onChange={(e) => set({ body_en: e.target.value })} className={AREA} />
            </div>
            {kind === "NOTICE" ? (
              <>
                <Input label={t("fields.date")} type="date" required value={d.published_on} onChange={(e) => set({ published_on: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={d.ticker} onChange={(e) => set({ ticker: e.target.checked })} />
                  {t("fields.ticker")}
                </label>
              </>
            ) : (
              <Input label={t("fields.position")} type="number" min={0} max={9999} hint={t("fields.positionHint")} value={d.position} onChange={(e) => set({ position: e.target.value })} />
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={d.published} onChange={(e) => set({ published: e.target.checked })} />
              {t("fields.published")}
            </label>
            {error && <p role="alert" className="text-sm text-critical">{te(error)}</p>}
          </form>
        )}
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t("deleteTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>{tc("cancel")}</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>{t("delete")}</Button>
          </>
        }
      >
        <p className="text-ink">{t("deleteBody", { title: removing ? pick(removing, locale, "title") : "" })}</p>
      </Modal>
    </Card>
  );
}
