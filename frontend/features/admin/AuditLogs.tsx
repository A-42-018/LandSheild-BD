"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RotateCcw, ScrollText, Search } from "lucide-react";
import { Button, Card, ErrorState, Input, LoadingState, Select, Table, type Column } from "@/components/ui";
import { formatDateTime } from "@/features/result/format";
import { KNOWN_ACTIONS } from "@/features/officer/types";
import { AUDIT_ENTITIES, AUDIT_PAGE_SIZE, type AuditLogItem, type AuditParams } from "./types";
import { useAuditLogs } from "./useAuditLogs";

const INITIAL: AuditParams = { actor: "", action: "", entity: "", from: "", to: "", page: 1 };
const ROLE_CODES = ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"];

export default function AuditLogs() {
  const t = useTranslations("admin.audit");
  const ta = useTranslations("officer.activity");
  const tr = useTranslations("roles");
  const locale = useLocale();
  const [params, setParams] = useState<AuditParams>(INITIAL);
  const [draft, setDraft] = useState<AuditParams>(INITIAL);
  const q = useAuditLogs(params);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    setParams({ ...draft, page: 1 });
  };
  const reset = () => {
    setDraft(INITIAL);
    setParams(INITIAL);
  };
  const rangeInvalid = !!draft.from && !!draft.to && draft.from > draft.to;

  const columns: Column<AuditLogItem>[] = [
    { key: "created_at", header: t("cols.time"), className: "whitespace-nowrap", render: (r) => formatDateTime(r.created_at, locale, "—") },
    {
      key: "actor",
      header: t("cols.actor"),
      render: (r) =>
        r.actor
          ? `${r.actor.name} (${ROLE_CODES.includes(r.actor.role) ? tr(r.actor.role) : r.actor.role})`
          : t("system"),
    },
    {
      key: "action",
      header: t("cols.action"),
      render: (r) => (KNOWN_ACTIONS.includes(r.action) ? ta(`actions.${r.action}`) : r.action),
    },
    {
      key: "entity",
      header: t("cols.entity"),
      render: (r) => (AUDIT_ENTITIES.includes(r.entity_type) ? t(`entities.${r.entity_type}`) : r.entity_type),
    },
    {
      key: "ip_hash",
      header: t("cols.ip"),
      render: (r) => (r.ip_hash ? <code className="font-mono text-xs">{r.ip_hash}…</code> : <span className="text-ink-muted">—</span>),
    },
  ];

  return (
    <Card title={t("title")} icon={<ScrollText />} accent="primary">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{t("hint")}</p>
        <form
          onSubmit={apply}
          role="search"
          aria-label={t("filters")}
          className="grid grid-cols-1 gap-3 glass-card p-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input label={t("actor")} value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} />
          <Select
            label={t("action")}
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            placeholder={t("all")}
            options={KNOWN_ACTIONS.map((a) => ({ value: a, label: ta(`actions.${a}`) }))}
          />
          <Select
            label={t("entity")}
            value={draft.entity}
            onChange={(e) => setDraft({ ...draft, entity: e.target.value })}
            placeholder={t("all")}
            options={AUDIT_ENTITIES.map((x) => ({ value: x, label: t(`entities.${x}`) }))}
          />
          <Input type="date" label={t("from")} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          <Input
            type="date"
            label={t("to")}
            value={draft.to}
            error={rangeInvalid ? t("rangeInvalid") : undefined}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
          <div className="flex items-end gap-2">
            <Button type="submit" icon={<Search />} disabled={rangeInvalid}>{t("apply")}</Button>
            <Button type="button" variant="secondary" icon={<RotateCcw />} onClick={reset}>{t("reset")}</Button>
          </div>
        </form>

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState
            error={q.error}
            onRetry={() => q.refetch()}
          />
        ) : (
          <div aria-busy={q.isFetching} data-testid="audit-table">
            <Table
              caption={t("title")}
              columns={columns}
              rows={q.data.items}
              rowKey={(r) => r.id}
              page={params.page}
              pageSize={AUDIT_PAGE_SIZE}
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
