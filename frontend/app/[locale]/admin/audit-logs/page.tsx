import { getTranslations, setRequestLocale } from "next-intl/server";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import AuditLogs from "@/features/admin/AuditLogs";

export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("admin.audit.title")} purpose={t("admin.audit.purpose")} crumbs={[{ label: t("admin.nav.label"), href: "/admin" }]} />
      <AuditLogs />
    </div>
  );
}
