import { getTranslations, setRequestLocale } from "next-intl/server";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import AdminOverview from "@/features/admin/AdminOverview";

export default async function AdminHomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader root title={t("admin.overview.title")} purpose={t("admin.overview.purpose")} />
      <AdminOverview />
    </div>
  );
}
