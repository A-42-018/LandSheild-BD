"use client";
import { useLocale, useTranslations } from "next-intl";
import { pick, usePublicContent } from "@/features/content/content";
import { NOTICES } from "./notices";

export interface NoticeView {
  id: string;
  date: string;
  ticker: boolean;
  title: string;
  body: string;
}

/** The notices to show, newest first. Admin-managed ones (U3.6) once loaded; the built-in sample copy (`NOTICES` +
 *  `landing.notices.items`) while loading or when the server cannot be reached. An empty server list means "none". */
export function useNotices(): NoticeView[] {
  const t = useTranslations("landing.notices");
  const locale = useLocale();
  const served = usePublicContent("NOTICE");
  if (served) {
    return served.map((n) => ({ id: n.id, date: n.published_on ?? "", ticker: n.ticker, title: pick(n, locale, "title"), body: pick(n, locale, "body") }));
  }
  return NOTICES.map((n) => ({ id: n.id, date: n.date, ticker: n.ticker, title: t(`items.${n.id}.title`), body: t(`items.${n.id}.body`) }));
}
