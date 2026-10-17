"use client";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { pick, usePublicContent } from "@/features/content/content";

/** Guides written by an admin (U3.6, `kind=GUIDE`), as text, under the picture guides. Nothing shows until there is at least one. */
export default function MoreGuides() {
  const t = useTranslations("guide.more");
  const locale = useLocale();
  const items = usePublicContent("GUIDE");
  if (!items?.length) return null;
  return (
    <section aria-labelledby="guide-more-h" className="glass-card p-5 sm:p-6" data-testid="guide-more">
      <h2 id="guide-more-h" className="section-title text-xl font-semibold text-ink">{t("title")}</h2>
      <p className="mt-2 text-ink-muted">{t("intro")}</p>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((c) => (
          <details key={c.id} className="group rounded-xl border border-line/70 bg-surface/60">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
              {pick(c, locale, "title")}
              <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
            </summary>
            <p className="whitespace-pre-line px-4 pb-4 text-ink-muted">{pick(c, locale, "body")}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
