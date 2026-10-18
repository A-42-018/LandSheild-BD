"use client";
import { useTranslations } from "next-intl";
import ConsiderationSection from "./ConsiderationSection";
import DatesSection from "./DatesSection";
import ExecutionSection from "./ExecutionSection";
import PartiesSection from "./PartiesSection";
import { ReadOnlyRecord } from "./RecordEdit";
import RegistrationSection from "./RegistrationSection";
import ScheduleSection from "./ScheduleSection";
import TitleRecitalSection from "./TitleRecitalSection";
import type { LhdrRecord } from "../types";

/**
 * The digital deed (H6a, read-only): the LHDR record in sections shaped like the paper deed.
 * Registration · Dates · Parties · Consideration · Schedule (with boundaries) · Title recital · Execution.
 */
export default function DeedView({
  record,
  threshold = 0.85,
  readOnly = false,
}: {
  record: LhdrRecord;
  threshold?: number;
  /** H7d: no edit controls, whatever provider is above (a saved version is never edited here) */
  readOnly?: boolean;
}) {
  const t = useTranslations("review.deed");
  const body = (
    <div className="flex min-w-0 flex-col gap-4" data-testid="deed-view">
      <p className="text-xs text-ink-muted">{t("intro")}</p>
      <RegistrationSection record={record} threshold={threshold} />
      <DatesSection record={record} threshold={threshold} />
      <PartiesSection record={record} threshold={threshold} />
      <ConsiderationSection record={record} threshold={threshold} />
      <ScheduleSection record={record} threshold={threshold} />
      <TitleRecitalSection record={record} threshold={threshold} />
      <ExecutionSection record={record} threshold={threshold} />
    </div>
  );
  return readOnly ? <ReadOnlyRecord>{body}</ReadOnlyRecord> : body;
}
