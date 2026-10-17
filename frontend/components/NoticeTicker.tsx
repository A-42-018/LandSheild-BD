"use client";
import { Megaphone, Pause, Play } from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { intlLocale } from "@/lib/intl-locale";
import { noticeAnchor } from "@/features/notices/notices";
import { useNotices } from "@/features/notices/useNotices";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded";
const TARGET = "min-h-9 [@media(pointer:coarse)]:min-h-touch";

/** Notice ticker (U1.4), under the header: notices flagged `ticker` scroll right to left, each linking to its card on the notice board.
 *  Moving text can be paused (button, hover, or keyboard focus). With "reduce motion" nothing moves: the row scrolls by hand and the
 *  second copy and the pause button are hidden (`.ticker-*` in globals.css). The second copy is for the seamless loop only, so it is
 *  hidden from screen readers and out of the tab order. */
export default function NoticeTicker() {
  const t = useTranslations("ticker");
  const locale = useLocale();
  const ticker = useNotices().filter((n) => n.ticker);
  const [paused, setPaused] = useState(false);
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: "UTC" });

  const list = (copy: boolean) => (
    <ul aria-hidden={copy || undefined} className={`flex shrink-0 items-center gap-8 pr-8 ${copy ? "ticker-copy" : ""}`}>
      {ticker.map((n) => (
        <li key={n.id} className="whitespace-nowrap">
          <Link href={`/#${noticeAnchor(n.id)}`} tabIndex={copy ? -1 : undefined} className={`inline-flex items-center gap-2 text-sm text-ink hover:text-primary ${TARGET} ${FOCUS}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <time dateTime={n.date} className="font-semibold text-primary">{fmt.format(new Date(n.date))}</time>
            <span>{n.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  if (ticker.length === 0) return null;
  return (
    <div role="region" aria-label={t("label")} data-testid="notice-ticker" data-paused={paused} className="ticker border-b border-primary/15 bg-primary-soft print:hidden">
      <div className="mx-auto flex max-w-[75rem] items-center gap-3 px-4">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
          <Megaphone aria-hidden="true" className="h-3.5 w-3.5" />
          {t("badge")}
        </span>
        <div className="ticker-viewport min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex w-max">
            {list(false)}
            {list(true)}
          </div>
        </div>
        <button
          type="button"
          aria-pressed={paused}
          aria-label={paused ? t("play") : t("pause")}
          title={paused ? t("play") : t("pause")}
          onClick={() => setPaused(!paused)}
          className={`ticker-pause inline-flex shrink-0 items-center justify-center px-2 text-primary hover:bg-primary/10 min-w-9 [@media(pointer:coarse)]:min-w-touch ${TARGET} ${FOCUS}`}
        >
          {paused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
        </button>
        <Link href="/#notices-title" className={`inline-flex shrink-0 items-center whitespace-nowrap px-1 text-sm font-semibold text-primary underline-offset-2 hover:underline ${TARGET} ${FOCUS}`}>
          {t("all")}
        </Link>
      </div>
    </div>
  );
}
