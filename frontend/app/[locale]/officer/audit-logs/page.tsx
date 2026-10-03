import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { OFFICER_UP } from "@/features/auth/roles";
import AuditLogs from "@/features/admin/AuditLogs";

export default function AuditLogsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <RequireRole roles={OFFICER_UP}>
      <AuditLogs />
    </RequireRole>
  );
}
