import { getTranslations, setRequestLocale } from "next-intl/server";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import SettingsPanel from "@/features/admin/SettingsPanel";

export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("admin.settings.title")} purpose={t("admin.settings.purpose")} crumbs={[{ label: t("admin.nav.label"), href: "/admin" }]} />
      <SettingsPanel />
    </div>
  );
}
