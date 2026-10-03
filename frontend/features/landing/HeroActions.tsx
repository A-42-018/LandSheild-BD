"use client";
import { ArrowRight, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { hasRole, OFFICER_UP } from "@/features/auth/roles";

const cta =
  "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Verify is for everyone; Upload Doc only for officers/admins (matches the /officer/upload guard). */
export default function HeroActions() {
  const t = useTranslations();
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href="/verify" className={`${cta} bg-primary text-primary-fg shadow-card hover:bg-primary/90`}>
        {t("landing.ctaVerify")}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
      {hasRole(user?.role, OFFICER_UP) && (
        <Link href="/officer/upload" className={`${cta} border border-line bg-surface text-ink shadow-card hover:bg-surface-muted`}>
          <UploadCloud aria-hidden="true" className="h-4 w-4" />
          {t("landing.ctaUpload")}
        </Link>
      )}
    </div>
  );
}
