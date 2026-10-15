"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { activeNavHref, navItemsFor } from "@/features/auth/roles";

// Uppercase text links; the active one is gold with a gold underline (reference header).
const PILL =
  "relative inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-1.5 text-[13.5px] font-semibold uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:transition-opacity";

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
      className="flex flex-col items-stretch gap-1 min-[1120px]:flex-1 min-[1120px]:flex-row min-[1120px]:items-center min-[1120px]:justify-center min-[1120px]:gap-2"
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
                ? "text-[#E9C96F] after:bg-[#D6B25C] after:opacity-100"
                : "text-white/90 after:bg-white/50 after:opacity-0 hover:text-white hover:after:opacity-100"
            }`}
          >
            {t(i.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
