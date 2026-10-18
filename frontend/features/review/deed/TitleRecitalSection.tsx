"use client";
import { useTranslations } from "next-intl";
import { ScrollText } from "lucide-react";
import { Card } from "@/components/ui";
import FieldValue, { FieldGrid } from "./FieldValue";
import { useYesNo } from "./useDeedLabels";
import type { LhdrRecord } from "../types";

/** G. Title recital: how the seller got the land and the stated freedom from encumbrance. */
export default function TitleRecitalSection({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const yn = useYesNo();
  const r = record.title_recital;
  return (
    <Card title={t("sections.titleRecital")} icon={<ScrollText />} data-testid="deed-section-title">
      <FieldGrid>
        <FieldValue id="basis" label={t("basis")} field={r?.basis} threshold={threshold} path="/title_recital/basis" />
        <FieldValue id="prior_deed" label={t("priorDeed")} field={r?.prior_deed} threshold={threshold} path="/title_recital/prior_deed" />
        <FieldValue id="nature" label={t("nature")} field={r?.nature} threshold={threshold} path="/title_recital/nature" />
        <FieldValue id="encumbrance_free" label={t("encumbranceFree")} field={r?.encumbrance_free} threshold={threshold} format={yn} path="/title_recital/encumbrance_free" kind="boolean" />
      </FieldGrid>
    </Card>
  );
}
