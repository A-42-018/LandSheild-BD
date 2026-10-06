"use client";
import { useLocale, useTranslations } from "next-intl";
import { Gavel } from "lucide-react";
import { Card, Table, type Column } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { formatDate } from "./format";
import type { EncumbranceEntry } from "./types";

/** Cases / khas / acquisition / mortgage (F3a `GET /lands/{id}/encumbrances`). Reference + authority are staff-only (null for citizens). */
export default function EncumbranceTable({ items }: { items: EncumbranceEntry[] }) {
  const t = useTranslations("result");
  const locale = useLocale();
  const dash = "—";
  const columns: Column<EncumbranceEntry>[] = [
    { key: "type", header: t("type"), render: (r) => (t.has(`encType.${r.type}`) ? t(`encType.${r.type}`) : r.type) },
    { key: "status", header: t("status"), render: (r) => <StatusBadge code={r.status} /> },
    { key: "from", header: t("startedOn"), render: (r) => formatDate(r.started_at, locale, t("unknownDate")) },
    { key: "to", header: t("resolvedOn"), render: (r) => formatDate(r.resolved_at, locale, t("notResolved")) },
    { key: "ref", header: t("reference"), render: (r) => r.reference_no ?? dash },
    { key: "auth", header: t("authority"), render: (r) => r.authority ?? dash },
  ];
  return (
    <Card title={t("encumbrances")} icon={<Gavel />}>
      <Table
        caption={t("encumbrances")}
        columns={columns}
        rows={items}
        rowKey={(r) => `${r.type}-${r.started_at}-${r.reference_no}`}
        emptyText={t("noEncumbrances")}
      />
    </Card>
  );
}
