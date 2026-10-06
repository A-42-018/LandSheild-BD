import { ArrowRight, Calculator, Ruler, Scale, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";

export const TOOLS: { key: "units" | "fees" | "faraid"; href: string; icon: LucideIcon }[] = [
  { key: "units", href: "/tools/units", icon: Ruler },
  { key: "fees", href: "/tools/fees", icon: Calculator },
  { key: "faraid", href: "/tools/inheritance", icon: Scale },
];

export default function ToolsHub() {
  const t = useTranslations("tools");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t("title")} purpose={t("hubIntro")} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TOOLS.map(({ key, href, icon: I }) => (
          <li key={key}>
            <Link href={href} data-testid="tool-tile" className="flex h-full min-h-11 items-start gap-3 rounded-md border border-line bg-surface p-4 transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <I aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <span className="flex-1">
                <span className="block font-semibold text-ink">{t(`${key}.title`)}</span>
                <span className="mt-1 block text-sm text-ink-muted">{t(`${key}.desc`)}</span>
              </span>
              <ArrowRight aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
