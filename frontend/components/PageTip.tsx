import { ChevronDown, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";

/** Pages that carry a tip (U4.2); each has `pageTip.<id>.{s1,s2,s3}` in both message files. */
export const PAGE_TIPS = ["verify", "check", "track", "verifyDoc", "my", "officer", "reviewer", "upload", "mutations"] as const;
export type PageTipId = (typeof PAGE_TIPS)[number];
export const TIP_STEPS = ["s1", "s2", "s3"] as const;

/** "এই পাতায় কী করবেন?": a closed-by-default tip with three short steps, placed right under the page header.
 *  Native <details>, so it opens with Enter/Space and works without JavaScript; a closed tip is read aloud by its title only. */
export default function PageTip({ page }: { page: PageTipId }) {
  const t = useTranslations("pageTip");
  return (
    <details className="glass-card group p-0 print:hidden" data-testid="page-tip" data-page={page}>
      <summary className="flex min-h-touch cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="icon-tile !h-9 !w-9"><Lightbulb className="h-5 w-5" /></span>
        <span className="flex-1">{t("title")}</span>
        <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <ul className="space-y-2 px-4 pb-4 text-ink">
        {TIP_STEPS.map((s) => (
          <li key={s} className="flex gap-2">
            <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <span>{t(`${page}.${s}`)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
