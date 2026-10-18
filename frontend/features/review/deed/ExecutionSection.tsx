"use client";
import { useTranslations } from "next-intl";
import { PenLine } from "lucide-react";
import { Card } from "@/components/ui";
import { SealList, StampList, WitnessList } from "./ExecutionList";
import FieldValue, { FieldGrid } from "./FieldValue";
import type { LhdrRecord } from "../types";

/** H. Execution & attestation: seller's mark, deed writer, witnesses, stamps and seals (lists in ExecutionList, H6c). */
export default function ExecutionSection({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const e = record.execution;
  return (
    <Card title={t("sections.execution")} icon={<PenLine />} data-testid="deed-section-execution">
      <div className="flex flex-col gap-4">
        <FieldGrid>
          <FieldValue id="seller_mark" label={t("sellerMark")} field={e?.seller_mark} threshold={threshold} path="/execution/seller_mark" />
          <FieldValue id="writer_name" label={t("writerName")} field={e?.deed_writer?.name} threshold={threshold} path="/execution/deed_writer/name" />
          <FieldValue id="writer_licence" label={t("licenceNo")} field={e?.deed_writer?.licence_no} threshold={threshold} path="/execution/deed_writer/licence_no" />
        </FieldGrid>
        <WitnessList record={record} threshold={threshold} />
        <StampList record={record} threshold={threshold} />
        <SealList record={record} threshold={threshold} />
      </div>
    </Card>
  );
}
