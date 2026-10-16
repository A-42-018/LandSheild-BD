import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { FaqId } from "./pages";

/** Native `<details>` accordion over `info.faq.<id>`: keyboard and screen-reader support without script. Shared by /faq (all) and the home page (top 5). */
export default function FaqList({ ids, testId }: { ids: readonly FaqId[]; testId?: string }) {
  const t = useTranslations("info.faq");
  return (
    <div className="flex flex-col gap-2">
      {ids.map((id) => (
        <details key={id} data-testid={testId} className="glass-card group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
            {t(`${id}.q`)}
            <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-4 text-ink-muted">{t(`${id}.a`)}</p>
        </details>
      ))}
    </div>
  );
}
