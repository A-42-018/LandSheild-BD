"use client";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/lib/intl-locale";
import { noticeAnchor } from "./notices";
import { useNotices } from "./useNotices";

/** The home page notice cards. A client component because `useNotices` loads the admin-managed list in the browser (U3.6);
 *  the band around it stays a server component. */
export default function NoticeList() {
  const t = useTranslations("landing.notices");
  const locale = useLocale();
  const notices = useNotices();
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long", timeZone: "UTC" });
  return (
    <>
      {notices.length === 0 && <p className="mt-6 text-ink-muted">{t("empty")}</p>}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {notices.map((n) => (
          <li key={n.id} id={noticeAnchor(n.id)} data-testid="notice-item" className="glass-card scroll-mt-28 border-l-4 !border-l-primary p-4">
            <time dateTime={n.date} className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">{fmt.format(new Date(n.date))}</time>
            <p className="mt-1 font-semibold text-ink">{n.title}</p>
            <p className="mt-1 text-sm text-ink-muted">{n.body}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
