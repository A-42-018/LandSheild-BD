"use client";
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ErrorState, LoadingState } from "@/components/ui";
import { useAuth } from "./AuthContext";
import { hasRole, loginPathFor, type Role } from "./roles";

export default function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();

  useEffect(() => {
    // Keep the query (e.g. a land search started on the home page) so sign-in brings the user back to it.
    if (status === "anonymous")
      router.replace(`${loginPathFor(roles)}?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [status, router, pathname, roles]);

  if (status === "loading") return <LoadingState label={t("auth.checkingSession")} />;
  if (status === "anonymous") return <LoadingState label={t("auth.loginRequired")} />;
  if (roles && !hasRole(user?.role, roles)) return <ErrorState message={t("errors.permission")} />;
  return <>{children}</>;
}
