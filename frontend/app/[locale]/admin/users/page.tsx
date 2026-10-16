import { getTranslations, setRequestLocale } from "next-intl/server";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import UsersPanel from "@/features/admin/UsersPanel";

export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("admin.console.users.title")} purpose={t("admin.console.users.hint")} crumbs={[{ label: t("admin.nav.label"), href: "/admin" }]} />
      <UsersPanel />
    </div>
  );
}
