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

/** The deed's sections in paper order; each key is also its `review.deed.sections.*` label. */
export const DEED_SECTIONS = [
  "registration", "dates", "parties", "consideration", "schedule", "titleRecital", "execution",
] as const;
export type DeedSection = (typeof DEED_SECTIONS)[number];

/**
 * The digital deed (H6a, read-only): the LHDR record in sections shaped like the paper deed.
 * Registration · Dates · Parties · Consideration · Schedule (with boundaries) · Title recital · Execution.
 */
export default function DeedView({
  record,
  threshold = 0.85,
  readOnly = false,
  landId,
}: {
  record: LhdrRecord;
  threshold?: number;
  /** H7d: no edit controls, whatever provider is above (a saved version is never edited here) */
  readOnly?: boolean;
  /** SJ7: the linked parcel, so the schedule can show its survey and JL */
  landId?: string | null;
}) {
  const t = useTranslations("review.deed");
  // the review screen's "Go to" links jump to these anchors (only one editable deed is on a page)
  const at = (k: DeedSection, el: React.ReactNode) =>
    readOnly ? el : <div id={`deed-anchor-${k}`} className="scroll-mt-48">{el}</div>;
  const body = (
    <div className="flex min-w-0 flex-col gap-4" data-testid="deed-view">
      <p className="text-xs text-ink-muted">{t("intro")}</p>
      {at("registration", <RegistrationSection record={record} threshold={threshold} />)}
      {at("dates", <DatesSection record={record} threshold={threshold} />)}
      {at("parties", <PartiesSection record={record} threshold={threshold} />)}
      {at("consideration", <ConsiderationSection record={record} threshold={threshold} />)}
      {at("schedule", <ScheduleSection record={record} threshold={threshold} landId={landId} />)}
      {at("titleRecital", <TitleRecitalSection record={record} threshold={threshold} />)}
      {at("execution", <ExecutionSection record={record} threshold={threshold} />)}
    </div>
  );
  return readOnly ? <ReadOnlyRecord>{body}</ReadOnlyRecord> : body;
}
