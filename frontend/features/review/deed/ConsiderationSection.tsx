"use client";
import { useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import { Card } from "@/components/ui";
import FieldValue, { FieldGrid } from "./FieldValue";
import type { LhdrRecord } from "../types";

const CURRENCIES = ["INR", "PKR", "BDT"];

/** E. Consideration: the amount, in words, as written and the currency of the era. */
export default function ConsiderationSection({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const c = record.consideration;
  return (
    <Card title={t("sections.consideration")} icon={<Banknote />} data-testid="deed-section-consideration">
      <FieldGrid>
        <FieldValue id="amount" label={t("amount")} field={c?.amount} threshold={threshold} path="/consideration/amount" kind="number" />
        <FieldValue id="in_words" label={t("inWords")} field={c?.in_words} threshold={threshold} path="/consideration/in_words" />
        <FieldValue id="currency_written" label={t("currencyWritten")} field={c?.currency_written} threshold={threshold} path="/consideration/currency_written" />
        <FieldValue id="era_currency" label={t("eraCurrency")} field={c?.era_currency} threshold={threshold} path="/consideration/era_currency" kind="select" options={CURRENCIES} />
        <FieldValue id="pay_mode" label={t("payMode")} field={c?.mode} threshold={threshold} path="/consideration/mode" />
      </FieldGrid>
    </Card>
  );
}
