"use client";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui";
import FieldValue, { FieldGrid } from "./FieldValue";
import { useEnumText } from "./useDeedLabels";
import type { LhdrRecord } from "../types";

const KINDS = [
  "SALE_SAF_KABALA", "GIFT_HEBA", "GIFT_DANPATRA", "PARTITION_BANTONNAMA", "EXCHANGE_EWAZ",
  "MORTGAGE_REHEN", "WAQF", "POWER_OF_ATTORNEY", "AGREEMENT_BAINANAMA", "OTHER",
]
const ERAS = ["BRITISH_INDIA", "EAST_BENGAL_PAKISTAN", "BANGLADESH"];

/** B. Registration (with the A. document kind and era, which belong on the same line of the paper). */
export default function RegistrationSection({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const kind = useEnumText("kinds");
  const era = useEnumText("eras");
  const r = record.registration;
  const d = record.document;
  return (
    <Card title={t("sections.registration")} icon={<FileText />} data-testid="deed-section-registration">
      <FieldGrid>
        <FieldValue id="kind" label={t("kind")} field={d?.kind} threshold={threshold} format={kind} path="/document/kind" kind="select" options={KINDS} />
        <FieldValue id="era" label={t("era")} field={d?.era} threshold={threshold} format={era} path="/document/era" kind="select" options={ERAS} />
        <FieldValue id="deed_no" label={t("deedNo")} field={r?.deed_no} threshold={threshold} path="/registration/deed_no" />
        <FieldValue id="deed_no_verbatim" label={t("deedNoVerbatim")} field={r?.deed_no_verbatim} threshold={threshold} path="/registration/deed_no_verbatim" />
        <FieldValue id="volume" label={t("volume")} field={r?.volume} threshold={threshold} path="/registration/volume" />
        <FieldValue id="reg_pages" label={t("regPages")} field={r?.pages} threshold={threshold} path="/registration/pages" />
        <FieldValue id="office" label={t("office")} field={r?.office} threshold={threshold} path="/registration/office" />
        <FieldValue id="reg_year" label={t("regYear")} field={r?.year} threshold={threshold} path="/registration/year" kind="number" />
        <FieldValue id="endorsement" label={t("endorsement")} field={r?.endorsement} threshold={threshold} path="/registration/endorsement" />
        <FieldValue id="doc_pages" label={t("docPages")} field={d?.pages} threshold={threshold} path="/document/pages" kind="number" />
      </FieldGrid>
    </Card>
  );
}
