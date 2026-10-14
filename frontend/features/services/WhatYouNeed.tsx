import { ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ServiceId } from "./services";

/** "What you need" box shown above a service form; same list as the citizen charter. */
export default function WhatYouNeed({ service }: { service: ServiceId }) {
  const t = useTranslations("services");
  const need = Object.values(t.raw(`items.${service}.need`) as Record<string, string>);
  return (
    <aside aria-labelledby={`need-${service}`} className="rounded-md border border-line bg-primary-soft p-4" data-testid="what-you-need">
      <h2 id={`need-${service}`} className="flex items-center gap-2 text-base font-semibold text-ink">
        <ListChecks aria-hidden="true" className="h-5 w-5 text-primary" />
        {t("whatYouNeed")}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
        {need.map((n) => <li key={n}>{n}</li>)}
      </ul>
    </aside>
  );
}
