import { getTranslations, setRequestLocale } from "next-intl/server";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import OfficerRequestsPanel from "@/features/admin/OfficerRequestsPanel";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("admin.console.officers.title");

export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("admin.console.officers.title")} purpose={t("admin.console.officers.hint")} crumbs={[{ label: t("admin.nav.label"), href: "/admin" }]} />
      <OfficerRequestsPanel />
    </div>
  );
}
