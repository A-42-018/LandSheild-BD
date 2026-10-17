import { getTranslations, setRequestLocale } from "next-intl/server";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import RecordsView from "@/features/admin/RecordsView";

export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("admin.console.dataTitle")} purpose={t("admin.console.dataPurpose")} crumbs={[{ label: t("admin.nav.label"), href: "/admin" }]} />
      <RecordsView />
    </div>
  );
}
