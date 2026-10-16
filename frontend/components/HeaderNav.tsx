"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { activeNavHref, navItemsFor } from "@/features/auth/roles";

// Below 1280px: full-width rows in the drop-down panel, active row has a gold side bar.
// From 1280px: uppercase text links in the bar, active one gold with a gold underline (reference header).
const PILL =
  "relative flex min-h-12 w-full items-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
  "after:absolute after:bottom-3 after:left-0 after:top-3 after:w-[3px] after:rounded-full after:transition-opacity " +
  "min-[1280px]:inline-flex min-[1280px]:min-h-11 min-[1280px]:w-auto min-[1280px]:rounded-md min-[1280px]:px-3 min-[1280px]:text-[0.84rem] " +
  "min-[1280px]:after:bottom-1.5 min-[1280px]:after:left-3 min-[1280px]:after:right-3 min-[1280px]:after:top-auto min-[1280px]:after:h-0.5 min-[1280px]:after:w-auto";

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
      className="flex flex-col items-stretch gap-0.5 min-[1280px]:flex-1 min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:justify-center min-[1280px]:gap-2"
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
                ? "bg-white/[0.07] text-gold-strong after:bg-gold after:opacity-100 min-[1280px]:bg-transparent"
                : "text-white/90 after:bg-white/50 after:opacity-0 hover:bg-white/[0.05] hover:text-white min-[1280px]:hover:bg-transparent min-[1280px]:hover:after:opacity-100"
            }`}
          >
            {t(i.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
