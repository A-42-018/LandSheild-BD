import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import MyShell from "@/features/my/MyShell";

/** "আমার ভূমি সেবা" (U3.2): citizens only; staff have their own home (redirectFor). */
export default function MyLayout({ children, params: { locale } }: { children: ReactNode; params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <RequireRole roles={["CITIZEN"]}>
      <MyShell>{children}</MyShell>
    </RequireRole>
  );
}
