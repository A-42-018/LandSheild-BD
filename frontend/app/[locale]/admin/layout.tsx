import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { ADMIN_ONLY } from "@/features/auth/roles";
import AdminShell from "@/features/admin/AdminShell";

/** The administrator's console (U3.5): admins only. Replaces the old /officer/admin tab page. */
export default function AdminLayout({ children, params: { locale } }: { children: ReactNode; params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <RequireRole roles={ADMIN_ONLY}>
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
