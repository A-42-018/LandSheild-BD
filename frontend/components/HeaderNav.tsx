"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { activeNavHref, navItemsFor } from "@/features/auth/roles";

const PILL =
  "inline-flex min-h-11 items-center rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/** Header bar links (UD10 sketch: Home, Parcel Map). The remaining pages live in the user menu. */
export default function HeaderNav() {
  const t = useTranslations();
  const { user } = useAuth();
  const pathname = usePathname();
  const all = navItemsFor(user?.role ?? null);
  const active = activeNavHref(pathname ?? "/", all);
  const items = all.filter((i) => i.primary);

  return (
    <nav
      aria-label={t("nav.main")}
      className="flex flex-col items-stretch gap-1 md:flex-1 md:flex-row md:items-center md:gap-1"
    >
      {items.map((i) => {
        const isActive = i.href === active;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={isActive ? "page" : undefined}
            className={`${PILL} ${
              isActive
                ? "bg-white/20 text-white shadow-card ring-1 ring-white/40"
                : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            {t(i.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
