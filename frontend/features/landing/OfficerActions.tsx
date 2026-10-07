"use client";
import { LayoutDashboard, LogIn, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { hasRole, OFFICER_UP, REVIEW_UP } from "@/features/auth/roles";

const cta =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-fg transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Officer band CTA: officers/admins go straight to upload (matches the /officer/upload guard), reviewers
 * to their review queue on the dashboard, guests get sign-in; citizens see nothing. */
export default function OfficerActions() {
  const t = useTranslations("landing");
  const { user } = useAuth();
  if (hasRole(user?.role, OFFICER_UP))
    return (
      <Link href="/officer/upload" className={cta}>
        <UploadCloud aria-hidden="true" className="h-5 w-5" />
        {t("ctaUpload")}
      </Link>
    );
  if (hasRole(user?.role, REVIEW_UP))
    return (
      <Link href="/officer" className={cta} data-testid="landing-reviewer-cta">
        <LayoutDashboard aria-hidden="true" className="h-5 w-5" />
        {t("officer.openDashboard")}
      </Link>
    );
  if (user) return null;
  return (
    <Link href="/login" className={cta}>
      <LogIn aria-hidden="true" className="h-5 w-5" />
      {t("officer.signIn")}
    </Link>
  );
}
