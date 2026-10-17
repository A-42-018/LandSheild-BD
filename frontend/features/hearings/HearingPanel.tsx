"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { normalizeDigits } from "@/lib/intl-locale";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { dayLabel, dhakaDay, timeLabel, toHearingIso } from "./calendar";
import { useScheduleHearing } from "./useHearings";

/** Date of the hearing on the case page. Anyone on the case sees it; officers can set or move it while the case is in HEARING. */
export default function HearingPanel({ id, hearingAt, canSet }: { id: string; hearingAt: string | null | undefined; canSet: boolean }) {
  const t = useTranslations("hearings.panel");
  const locale = useLocale();
  const mut = useScheduleHearing(id);
  const today = dhakaDay(new Date().toISOString());
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [touched, setTouched] = useState(false);

  const day = normalizeDigits(date);
  const missing = touched && !day;
  const past = touched && !!day && day < today;
  const focus = useFocusFirstInvalid();
  const submit = () => {
    setTouched(true);
    if (!day || day < today) return focus.request();
    mut.mutate({ hearing_at: toHearingIso(day, normalizeDigits(time)) }, { onSuccess: () => setTouched(false) });
  };
  const err = missing ? t("errors.required") : past ? t("errors.past") : mut.isError ? (mut.error instanceof ApiError && mut.error.code === "HEARING_DATE_PAST" ? t("errors.past") : t("errors.failed")) : null;

  return (
    <Card title={t("title")} icon={<CalendarClock />} data-testid="hearing-panel">
      <p className="text-sm text-ink" data-testid="hearing-when">
        {hearingAt ? `${dayLabel(dhakaDay(hearingAt), locale)} · ${timeLabel(hearingAt, locale)}` : t("none")}
      </p>
      {canSet && (
        <form
          ref={focus.ref}
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <Input type="date" label={t("date")} value={date} min={today} onChange={(e) => setDate(e.target.value)} error={missing || past ? err ?? undefined : undefined} />
          <Input type="time" label={t("time")} value={time} onChange={(e) => setTime(e.target.value)} hint={t("hint")} />
          <Button type="submit" loading={mut.isPending} data-testid="hearing-save">{hearingAt ? t("move") : t("set")}</Button>
        </form>
      )}
      {err && !missing && !past && <p role="alert" className="mt-2 text-xs text-critical">{err}</p>}
      {mut.isSuccess && !mut.isPending && <p role="status" className="mt-2 text-xs text-verified">{t("saved")}</p>}
    </Card>
  );
}
