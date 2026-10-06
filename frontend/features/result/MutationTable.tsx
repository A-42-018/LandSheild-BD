"use client";
import { useLocale, useTranslations } from "next-intl";
import { FileCheck2 } from "lucide-react";
import { Card, Table, type Column } from "@/components/ui";
import StatusBadge from "@/components/domain/StatusBadge";
import { formatDate } from "./format";
import type { MutationEntry } from "./types";

export default function MutationTable({ mutations }: { mutations: MutationEntry[] }) {
  const t = useTranslations("result");
  const locale = useLocale();
  const na = t("unknownDate");
  const dash = "—";

  const columns: Column<MutationEntry>[] = [
    { key: "no", header: t("mutationNo"), render: (r) => r.mutation_no },
    { key: "status", header: t("status"), render: (r) => <StatusBadge code={r.status} /> },
    { key: "applied", header: t("appliedOn"), render: (r) => formatDate(r.applied_at, locale, na) },
    { key: "decided", header: t("decidedOn"), render: (r) => formatDate(r.decided_at, locale, t("notDecided")) },
    {
      key: "khatian",
      header: t("khatianChange"),
      render: (r) => (r.previous_khatian_no || r.new_khatian_no ? `${r.previous_khatian_no ?? dash} → ${r.new_khatian_no ?? dash}` : dash),
    },
    { key: "office", header: t("acLandOffice"), render: (r) => r.ac_land_office ?? dash },
  ];

  return (
    <Card title={t("mutations")} icon={<FileCheck2 />}>
      <Table
        caption={t("mutations")}
        columns={columns}
        rows={mutations}
        rowKey={(r) => r.mutation_no}
        emptyText={t("noMutations")}
      />
    </Card>
  );
}
