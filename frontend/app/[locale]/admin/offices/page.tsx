import { getTranslations, setRequestLocale } from "next-intl/server";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import OfficesPanel from "@/features/admin/OfficesPanel";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("admin.console.offices.title");

export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("admin.console.offices.title")} purpose={t("admin.console.offices.hint")} crumbs={[{ label: t("admin.nav.label"), href: "/admin" }]} />
      <OfficesPanel />
    </div>
  );
}
