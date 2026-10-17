import { getTranslations, setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { OFFICER_UP } from "@/features/auth/roles";
import AuditLogs from "@/features/admin/AuditLogs";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("admin.audit.title");

export default async function AuditLogsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <RequireRole roles={OFFICER_UP}>
      <div className="flex flex-col gap-4">
        <OfficerPageHeader title={t("admin.audit.title")} purpose={t("admin.audit.purpose")} />
        <AuditLogs />
      </div>
    </RequireRole>
  );
}
