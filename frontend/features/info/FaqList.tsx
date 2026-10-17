"use client";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { pick, usePublicContent } from "@/features/content/content";
import type { FaqId } from "./pages";

/** Native `<details>` accordion: keyboard and screen-reader support without script. Shared by /faq (all) and the home page (top `limit`).
 *  Questions are the admin-managed FAQ entries (U3.6) once loaded; until then, or when none exist yet or the server cannot be reached,
 *  the built-in `info.faq.<id>` copy for `ids`. */
export default function FaqList({ ids, limit, testId }: { ids: readonly FaqId[]; limit?: number; testId?: string }) {
  const t = useTranslations("info.faq");
  const locale = useLocale();
  const served = usePublicContent("FAQ");
  const items = served?.length
    ? served.slice(0, limit).map((c) => ({ id: c.id, q: pick(c, locale, "title"), a: pick(c, locale, "body") }))
    : ids.map((id) => ({ id, q: t(`${id}.q`), a: t(`${id}.a`) }));
  return (
    <div className="flex flex-col gap-2">
      {items.map(({ id, q, a }) => (
        <details key={id} data-testid={testId} className="glass-card group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
            {q}
            <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
          </summary>
          <p className="whitespace-pre-line px-5 pb-4 text-ink-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
