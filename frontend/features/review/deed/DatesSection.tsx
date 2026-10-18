"use client";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui";
import FieldValue, { FieldGrid } from "./FieldValue";
import { useEnumText } from "./useDeedLabels";
import type { LhdrDeedDate, LhdrRecord } from "../types";

const CALENDARS = ["bangla", "gregorian", "hijri"];
const PRECISIONS = ["day", "day±1", "month", "year"];

function DateBlock({ id, title, d, threshold, base }: { id: string; title: string; d: LhdrDeedDate | null | undefined; threshold: number; base: string }) {
  const t = useTranslations("review.deed");
  const calendar = useEnumText("calendars");
  const precision = useEnumText("precisions");
  return (
    <div data-testid={`deed-date-${id}`} className="flex flex-col gap-1">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <FieldGrid>
        <FieldValue id={`${id}_verbatim`} label={t("dateVerbatim")} field={d?.verbatim} threshold={threshold} path={`${base}/verbatim`} />
        <FieldValue id={`${id}_calendar`} label={t("calendar")} field={d?.calendar} threshold={threshold} format={calendar} path={`${base}/calendar`} kind="select" options={CALENDARS} />
        <FieldValue id={`${id}_day`} label={t("day")} field={d?.day} threshold={threshold} path={`${base}/day`} kind="number" />
        <FieldValue id={`${id}_month`} label={t("month")} field={d?.month} threshold={threshold} path={`${base}/month`} />
        <FieldValue id={`${id}_year`} label={t("dateYear")} field={d?.year} threshold={threshold} path={`${base}/year`} kind="number" />
        <FieldValue id={`${id}_precision`} label={t("precision")} field={d?.precision} threshold={threshold} format={precision} path={`${base}/precision`} kind="select" options={PRECISIONS} />
        <FieldValue id={`${id}_from`} label={t("gregorianFrom")} field={d?.gregorian_from} threshold={threshold} path={`${base}/gregorian_from`} />
        <FieldValue id={`${id}_to`} label={t("gregorianTo")} field={d?.gregorian_to} threshold={threshold} path={`${base}/gregorian_to`} />
      </FieldGrid>
    </div>
  );
}

/** C. Dates: execution and registration are kept apart; a Bangla date shows its Gregorian range. */
export default function DatesSection({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  return (
    <Card title={t("sections.dates")} icon={<CalendarDays />} data-testid="deed-section-dates">
      <div className="flex flex-col gap-4">
        <DateBlock id="execution" title={t("execution")} d={record.dates?.execution} threshold={threshold} base="/dates/execution" />
        <DateBlock id="registration" title={t("registrationDate")} d={record.dates?.registration} threshold={threshold} base="/dates/registration" />
      </div>
    </Card>
  );
}
