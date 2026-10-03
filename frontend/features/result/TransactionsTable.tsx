"use client";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight } from "lucide-react";
import { Card, Table, type Column } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { formatArea, formatDate } from "./format";
import { useUnitLabel } from "./LandInfoCard";
import type { TransactionEntry } from "./types";

export default function TransactionsTable({ transactions }: { transactions: TransactionEntry[] }) {
  const t = useTranslations("result");
  const tt = useTranslations("result.txType");
  const locale = useLocale();
  const unit = useUnitLabel();

  const columns: Column<TransactionEntry>[] = [
    { key: "date", header: t("date"), render: (r) => formatDate(r.transaction_date, locale, t("unknownDate")) },
    { key: "type", header: t("type"), render: (r) => (tt.has(r.transaction_type) ? tt(r.transaction_type) : r.transaction_type) },
    { key: "seller", header: t("seller"), render: (r) => r.seller.name },
    { key: "buyer", header: t("buyer"), render: (r) => r.buyer.name },
    { key: "area", header: t("area"), render: (r) => formatArea(r.area, r.area_unit, locale, unit(r.area_unit)) },
    { key: "status", header: t("status"), render: (r) => <StatusBadge code={r.status} /> },
  ];

  return (
    <Card title={t("transactions")} icon={<ArrowLeftRight />}>
      <Table
        caption={t("transactions")}
        columns={columns}
        rows={transactions}
        rowKey={(r) => `${r.transaction_date}-${r.seller.name}-${r.buyer.name}-${r.area}`}
        emptyText={t("noTransactions")}
      />
    </Card>
  );
}
