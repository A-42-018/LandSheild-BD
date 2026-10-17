import { getTranslations, setRequestLocale } from "next-intl/server";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import ContentPanel from "@/features/admin/ContentPanel";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("admin.console.content.title");

export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("admin.console.content.title")} purpose={t("admin.console.content.hint")} crumbs={[{ label: t("admin.nav.label"), href: "/admin" }]} />
      <ContentPanel />
    </div>
  );
}
