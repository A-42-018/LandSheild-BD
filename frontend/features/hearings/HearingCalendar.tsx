"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import StatusBadge from "@/components/domain/StatusBadge";
import { Button, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import AreaFilter, { NO_AREA, type Area } from "@/features/officers/AreaFilter";
import type { MutationQueueItem } from "@/features/mutation/types";
import { localDigits } from "@/lib/intl-locale";
import { currentMonth, dayLabel, dhakaDay, monthGrid, monthLabel, monthOf, shiftMonth, timeLabel, weekdayNames } from "./calendar";
import { useHearingCalendar } from "./useHearings";

export default function HearingCalendar() {
  const t = useTranslations("hearings");
  const locale = useLocale();
  const [month, setMonth] = useState(() => currentMonth());
  const [area, setArea] = useState<Area>(NO_AREA);
  const [picked, setPicked] = useState<string | null>(null);
  const q = useHearingCalendar(month, area);
  const today = dhakaDay(new Date().toISOString());

  const byDay = useMemo(() => {
    const map = new Map<string, MutationQueueItem[]>();
    for (const m of q.data?.items ?? []) {
      if (!m.hearing_at) continue;
      const day = dhakaDay(m.hearing_at);
      map.set(day, [...(map.get(day) ?? []), m]);
    }
    return map;
  }, [q.data]);

  // The open day: the one picked, else today (this month), else the first day with a hearing.
  const selected = picked && monthOf(picked) === month ? picked : monthOf(today) === month ? today : ([...byDay.keys()].sort()[0] ?? null);
  useEffect(() => setPicked(null), [month]);

  const weekdays = weekdayNames(locale);
  const weekdaysLong = weekdayNames(locale, "long");
  const fmt = (n: number) => localDigits(n, locale);
  const grid = monthGrid(month);
  const dayItems = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("title")} purpose={t("purpose")} />
      <Card title={t("area")}>
        <AreaFilter value={area} onChange={setArea} />
      </Card>

      <Card
        variant="record"
        title={monthLabel(month, locale)}
        icon={<CalendarDays />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label={t("monthNav")}>
          <Button variant="secondary" size="sm" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label={t("prev")} data-testid="cal-prev"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={() => setMonth(currentMonth())} data-testid="cal-today">{t("today")}</Button>
          <Button variant="secondary" size="sm" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label={t("next")} data-testid="cal-next"><ChevronRight aria-hidden="true" className="h-4 w-4" /></Button>
        </div>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <table className="w-full table-fixed border-separate border-spacing-1 text-center" data-testid="cal-grid">
              <caption className="sr-only">{t("gridLabel", { month: monthLabel(month, locale) })}</caption>
              <thead>
                <tr>
                  {weekdays.map((w, i) => (
                    <th key={i} scope="col" className={`py-1 text-xs font-semibold ${i >= 5 ? "text-ink-muted" : "text-ink"}`}>
                      <abbr title={weekdaysLong[i]} className="no-underline">{w}</abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((c) => {
                      const n = byDay.get(c.date)?.length ?? 0;
                      const isSel = c.date === selected;
                      const day = Number(c.date.slice(8));
                      return (
                        <td key={c.date} className="p-0">
                          {c.inMonth ? (
                            <button
                              type="button"
                              onClick={() => setPicked(c.date)}
                              aria-pressed={isSel}
                              aria-current={c.date === today ? "date" : undefined}
                              aria-label={n > 0 ? t("dayWith", { date: dayLabel(c.date, locale), count: n }) : dayLabel(c.date, locale)}
                              data-testid={`day-${c.date}`}
                              data-count={n}
                              className={`flex min-h-12 w-full flex-col items-center justify-center rounded-lg border text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${isSel ? "border-primary bg-primary-soft font-semibold text-primary" : c.date === today ? "border-gold bg-surface text-ink" : "border-line bg-surface text-ink hover:bg-primary-soft/60"}`}
                            >
                              <span>{fmt(day)}</span>
                              {n > 0 && <span className="mt-0.5 rounded-full bg-review-soft px-1.5 text-xs font-semibold text-review">{fmt(n)}</span>}
                            </button>
                          ) : (
                            <span aria-hidden="true" className="block min-h-12" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <section aria-labelledby="day-title" className="mt-4 border-t border-line pt-4" data-testid="cal-day">
              <h2 id="day-title" className="font-display text-lg font-semibold text-ink">
                {selected ? dayLabel(selected, locale) : t("noDay")}
              </h2>
              {dayItems.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">{t("noneThisDay")}</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {dayItems.map((m) => (
                    <HearingRow key={m.id} m={m} locale={locale} showTime />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </Card>

      <Card title={t("unscheduled.title")}>
        <p className="mb-2 text-sm text-ink-muted">{t("unscheduled.hint")}</p>
        {q.data && q.data.unscheduled.length === 0 ? (
          <EmptyState title={t("unscheduled.none")} />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="cal-unscheduled">
            {(q.data?.unscheduled ?? []).map((m) => (
              <HearingRow key={m.id} m={m} locale={locale} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function HearingRow({ m, locale, showTime = false }: { m: MutationQueueItem; locale: string; showTime?: boolean }) {
  const t = useTranslations("hearings");
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface p-3 text-sm">
      {showTime && m.hearing_at && <span className="font-semibold text-ink" data-testid="hearing-time">{timeLabel(m.hearing_at, locale)}</span>}
      <Link href={`/officer/mutations/${m.id}`} className="font-medium text-primary underline" aria-label={t("open", { no: m.mutation_no })}>
        {m.mutation_no}
      </Link>
      <span className="font-mono text-ink-muted">{m.land_id}</span>
      <span className="text-ink">{m.applicant}</span>
      <StatusBadge code={m.status} />
    </li>
  );
}
