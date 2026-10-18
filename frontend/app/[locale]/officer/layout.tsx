import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { REVIEW_UP } from "@/features/auth/roles";
import OfficerShell from "@/features/officer/OfficerShell";
import ClientMessages from "@/components/ClientMessages";

export default function OfficerLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="officer">
      <RequireRole roles={REVIEW_UP}>
        <OfficerShell>{children}</OfficerShell>
      </RequireRole>
    </ClientMessages>
  );
}
