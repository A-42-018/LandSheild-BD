import { Calculator, Ruler, Scale, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import ArtCard from "@/components/ArtCard";
import PageHeader from "@/components/PageHeader";
import { TOOL_ART } from "@/features/landing/Illustrations";

export const TOOLS: { key: "units" | "fees" | "faraid"; href: string; icon: LucideIcon }[] = [
  { key: "units", href: "/tools/units", icon: Ruler },
  { key: "fees", href: "/tools/fees", icon: Calculator },
  { key: "faraid", href: "/tools/inheritance", icon: Scale },
];

export default function ToolsHub() {
  const t = useTranslations("tools");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t("title")} purpose={t("hubIntro")} art={<TOOL_ART.fees />} />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {TOOLS.map(({ key, href, icon }) => (
          <li key={key} className="sm:last:col-span-2 sm:last:mx-auto sm:last:w-[calc(50%-0.625rem)]">
            <ArtCard href={href} testId="tool-tile" icon={icon} art={TOOL_ART[key]} title={t(`${key}.title`)} desc={t(`${key}.desc`)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
