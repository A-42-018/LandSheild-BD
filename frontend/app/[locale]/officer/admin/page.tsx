import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { ADMIN_ONLY } from "@/features/auth/roles";
import AdminView from "@/features/admin/AdminView";

export default function AdminPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <RequireRole roles={ADMIN_ONLY}>
      <AdminView />
    </RequireRole>
  );
}
